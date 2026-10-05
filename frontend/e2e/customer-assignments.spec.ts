import { test, expect, type Page, type TestInfo } from '@playwright/test'

const uid = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, '0')}`
const project = uid(100)
const route = uid(200)
const otherRoute = uid(201)
const tableURL = `/projects/${project}?tab=customers`
const mapURL = `/projects/${project}/map?route=${route}`
const apiURL = 'http://127.0.0.1:8001/api'
const browserErrors = new WeakMap<Page, string[]>()

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  if (name.startsWith('map-')) {
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect.poll(() => page.locator('.leaflet-marker-icon').count()).toBeGreaterThan(0)
    await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0)
    await expect.poll(() => page.locator('.leaflet-tile:not(.leaflet-tile-loaded)').count(), { timeout: 15_000 }).toBe(0)
    await expect.poll(() => page.locator('.leaflet-tile').evaluateAll((tiles) =>
      tiles.every((tile) => getComputedStyle(tile).opacity === '1'),
    )).toBeTruthy()
    await page.mouse.move(5, 5)
  }
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

function pin(page: Page, name: string, status: string) {
  return page.locator(`.leaflet-marker-icon[title="${name} · ${status}"]`)
}

test.beforeEach(async ({ page, request }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  const login = await request.post(`${apiURL}/auth/login/`, { data: { email: 'playwright@example.com', password: 'Playwright123!' } })
  expect(login.ok()).toBeTruthy()
  const { token } = await login.json()
  const headers = { Authorization: `Bearer ${token}` }
  const routes = await request.get(`${apiURL}/routes/?project=${project}`, { headers })
  for (const r of await routes.json()) {
    if (r.id !== route && r.id !== otherRoute) {
      expect((await request.delete(`${apiURL}/routes/${r.id}/`, { headers })).ok()).toBeTruthy()
    }
  }
  // Release previous test additions before restoring the two saved routes.
  expect((await request.patch(`${apiURL}/routes/${otherRoute}/`, { headers, data: { customer_ids: [uid(1001)] } })).ok()).toBeTruthy()
  expect((await request.patch(`${apiURL}/routes/${route}/`, { headers, data: { name: 'Morning Route', customer_ids: [uid(1000), uid(1057)] } })).ok()).toBeTruthy()
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('playwright@example.com')
  await page.getByLabel('Password', { exact: true }).fill('Playwright123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/projects$/)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([])
})

test('table counts span pages and assignment changes reset pagination', async ({ page }, info) => {
  await page.goto(tableURL)
  await expect(page.getByRole('button', { name: 'All (58)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Route', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Actions', exact: true })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('row')).toHaveCount(51)
  await capture(page, info, 'customers-desktop')
  await page.getByRole('button', { name: /Next page/i }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('row')).toHaveCount(9)
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Unassigned (55)', exact: true }).click()
  await expect(page).toHaveURL(/assignment=unassigned/)
  expect(new URL(page.url()).searchParams.has('page')).toBeFalsy()
  await expect(page.getByRole('row')).toHaveCount(51)
  await expect(page.getByRole('table').getByRole('link', { name: 'Morning Route' })).toHaveCount(0)
  await page.getByRole('button', { name: /Next page/i }).click()
  await expect(page.getByRole('row')).toHaveCount(6)
  await page.getByRole('button', { name: 'Assigned (3)', exact: true }).click()
  await expect(page.getByRole('row')).toHaveCount(4)
  await expect(page.getByRole('table').getByRole('link', { name: 'Morning Route' })).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Assigned (3)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await capture(page, info, 'customers-assigned')
})

test('table search keeps project totals and combines with assignment', async ({ page }, info) => {
  await page.goto(tableURL)
  await page.getByRole('textbox', { name: 'Search customers' }).fill('Customer 02')
  await expect(page.getByRole('button', { name: 'All (1)', exact: true })).toBeVisible()
  await expect(page.getByText('1 customer matches your search · 1 unassigned match · 55 unassigned in project', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Assigned (0)', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No customers match' })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('q')).toBe('Customer 02')
  await capture(page, info, 'customers-search-empty')
  await page.getByRole('button', { name: 'Show all customers', exact: true }).click()
  await expect(page.getByRole('row')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Search customers' }).fill('NoSuchCustomer')
  await expect(page.getByRole('button', { name: 'All (0)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect(page.getByRole('button', { name: 'All (58)', exact: true })).toBeVisible()
})

test('invalid pages redirect preserving search and assignment; history restores filters', async ({ page }) => {
  await page.goto(`${tableURL}&assignment=unassigned&page=999&q=Customer`)
  await expect(page).toHaveURL(/page=2/)
  expect(new URL(page.url()).searchParams.get('assignment')).toBe('unassigned')
  expect(new URL(page.url()).searchParams.get('q')).toBe('Customer')
  await page.getByRole('button', { name: 'Assigned (3)', exact: true }).click()
  await expect(page.getByRole('row')).toHaveCount(4)
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('row')).toHaveCount(6)
})

test('fully assigned and empty projects have useful empty states', async ({ page }, info) => {
  await page.goto(`/projects/${uid(101)}?tab=customers&assignment=unassigned`)
  await expect(page.getByRole('heading', { name: 'All customers are assigned' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unassigned (0)', exact: true })).toBeVisible()
  await capture(page, info, 'customers-fully-assigned')
  await page.getByRole('button', { name: 'Show all customers' }).click()
  await expect(page.getByRole('row')).toHaveCount(4)
  await page.goto(`/projects/${uid(102)}?tab=customers`)
  await expect(page.getByRole('heading', { name: 'No customers yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add customer', exact: true })).toBeVisible()
})

test('map distinguishes three groups and retains the current route when filtering', async ({ page }, info) => {
  await page.goto(mapURL)
  await expect(page.getByText('58 in project · 2 on this route · 1 on other routes · 55 unassigned', { exact: true })).toBeVisible()
  await expect(page.getByText('1 unassigned without a map location', { exact: true })).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(57)
  await expect(pin(page, 'Customer 01', 'Assigned to Afternoon Route')).toBeVisible()
  await pin(page, 'Customer 01', 'Assigned to Afternoon Route').click()
  await expect(page.getByText('2 stops', { exact: true })).toBeVisible()
  await capture(page, info, 'map-desktop')
  await page.getByRole('button', { name: 'Unassigned (55)', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(56)
  await expect(pin(page, 'Customer 00', 'On this route, stop 1')).toBeVisible()
  await expect(pin(page, 'Customer 01', 'Assigned to Afternoon Route')).toHaveCount(0)
  await capture(page, info, 'map-unassigned')
})

test('draft add/remove changes counts instantly and save updates the table', async ({ page }, info) => {
  await page.goto(`${mapURL}&assignment=unassigned`)
  await expect(pin(page, 'Customer 02', 'Unassigned')).toBeVisible()
  await pin(page, 'Customer 02', 'Unassigned').click()
  await expect(page.getByRole('button', { name: 'Unassigned (54)', exact: true })).toBeVisible()
  await expect(page.getByText('58 in project · 3 on this route · 1 on other routes · 54 unassigned · Unsaved changes', { exact: true })).toBeVisible()
  await pin(page, 'Customer 02', 'On this route, stop 3').click()
  await expect(page.getByText('3 stops', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove Customer 00', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toBeVisible()
  await expect(pin(page, 'Customer 00', 'Unassigned')).toBeVisible()
  await capture(page, info, 'map-unsaved')
  // A separate saved-data view continues to show the original assignments.
  const savedView = await page.context().newPage()
  await savedView.goto(`${tableURL}&assignment=assigned`)
  await expect(savedView.getByRole('table').getByText('Customer 00', { exact: true })).toBeVisible()
  await expect(savedView.getByRole('table').getByText('Customer 02', { exact: true })).toHaveCount(0)
  await savedView.close()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await expect(page.getByText(/58 in project.*Unsaved changes/)).toHaveCount(0)
  await page.goto(`${tableURL}&assignment=assigned`)
  await expect(page.getByRole('table').getByText('Customer 02', { exact: true })).toBeVisible()
  await expect(page.getByRole('table').getByText('Customer 00', { exact: true })).toHaveCount(0)
  await page.getByRole('table').getByRole('link', { name: 'Morning Route' }).first().click()
  await expect(page).toHaveURL(new RegExp(`route=${route}`))
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Morning Route')
})

test('geographic search labels matching counts and preserves assignment and route colors', async ({ page }, info) => {
  await page.goto(`${mapURL}&state=NJ&assignment=unassigned`)
  await expect(page.getByText('23 customers match these filters · 22 unassigned matches · 55 unassigned in project', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unassigned (22)', exact: true })).toBeVisible()
  await expect(pin(page, 'Customer 00', 'On this route, stop 1')).toBeVisible()
  await expect(page.getByText('1 unassigned without a map location in these filters', { exact: true })).toBeVisible()
  await page.goto(`${mapURL}&assignment=unassigned`)
  await page.getByRole('textbox', { name: 'Search address', exact: true }).fill('Available Plaza')
  await expect(page.getByText('1 customer matches these filters · 1 unassigned match · 55 unassigned in project', { exact: true })).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3)
  await expect(pin(page, 'Customer 00', 'On this route, stop 1').locator('path')).toHaveAttribute('fill', '#0064E0')
  expect(new URL(page.url()).searchParams.get('assignment')).toBe('unassigned')
  await pin(page, 'Customer 02', 'Unassigned').click()
  await expect(page.getByText('1 customer matches these filters · 0 unassigned matches · 54 unassigned in project', { exact: true })).toBeVisible()
  await capture(page, info, 'map-filtered-draft')
  await page.getByRole('button', { name: 'Assigned (1)', exact: true }).click()
  await expect(page.getByText('3 stops', { exact: true })).toBeVisible()
  await expect(page.getByText(/58 in project.*54 unassigned.*Unsaved changes/)).toBeVisible()
})

test('new route creation preserves accurate totals after saving and reloading', async ({ page }) => {
  await page.goto(`/projects/${project}/map?search=Available%20Plaza&assignment=unassigned`)
  await pin(page, 'Customer 02', 'Unassigned').click()
  await page.getByRole('textbox', { name: /^Name/ }).fill('New Delivery Route')
  await page.getByRole('button', { name: 'Save route', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await expect(page.getByText(/58 in project · 1 on this route · 3 on other routes · 54 unassigned$/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unassigned (0)', exact: true })).toBeVisible()
})

test('failed save preserves the draft and explains a concurrent assignment conflict', async ({ page, request }, info) => {
  await page.goto(`${mapURL}&search=Available%20Plaza`)
  await pin(page, 'Customer 02', 'Unassigned').click()
  const login = await request.post(`${apiURL}/auth/login/`, { data: { email: 'playwright@example.com', password: 'Playwright123!' } })
  const { token } = await login.json()
  const response = await request.patch(`${apiURL}/routes/${otherRoute}/`, {
    headers: { Authorization: `Bearer ${token}` }, data: { customer_ids: [uid(1001), uid(1002)] },
  })
  expect(response.ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Some customers are already on another route.', { exact: true })).toBeVisible()
  await expect(page.getByText('3 stops', { exact: true })).toBeVisible()
  await expect(page.getByText(/58 in project.*Unsaved changes/)).toBeVisible()
  await capture(page, info, 'map-save-conflict')
})

test('removing an unpinned saved stop updates missing-location and assignment counts', async ({ page, request }) => {
  const login = await request.post(`${apiURL}/auth/login/`, { data: { email: 'playwright@example.com', password: 'Playwright123!' } })
  const { token } = await login.json()
  expect((await request.patch(`${apiURL}/routes/${route}/`, {
    headers: { Authorization: `Bearer ${token}` }, data: { customer_ids: [uid(1000), uid(1057), uid(1056)] },
  })).ok()).toBeTruthy()
  await page.goto(mapURL)
  await expect(page.getByText('58 in project · 3 on this route · 1 on other routes · 54 unassigned', { exact: true })).toBeVisible()
  await expect(page.getByText('1 unassigned without a map location', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove Customer 56', exact: true }).click()
  await expect(page.getByText('1 unassigned without a map location', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByText('1 unassigned without a map location', { exact: true })).toBeVisible()
})

test('map zero-match and zero-unassigned filters retain helpful controls', async ({ page }, info) => {
  await page.goto(`/projects/${uid(101)}/map?assignment=unassigned`)
  await expect(page.getByRole('heading', { name: 'All matching customers are assigned' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unassigned (0)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Assigned (3)', exact: true }).click()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3)
  await page.goto(`${mapURL}&search=NonexistentStreet&assignment=unassigned`)
  await expect(page.getByRole('button', { name: 'All (0)', exact: true })).toBeVisible()
  await expect(page.getByText('0 customers match these filters · 0 unassigned matches · 55 unassigned in project', { exact: true })).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2)
  await capture(page, info, 'map-no-matches-current-route')
})

test('mobile map and customer table keep counts and actions reachable', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${mapURL}&assignment=unassigned`)
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Route · 2 stops', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await capture(page, info, 'map-mobile')
  await page.getByRole('button', { name: 'Route · 2 stops', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Edit route' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove Customer 00', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unassigned (56)', exact: true })).toBeVisible()
  await page.goto(`${tableURL}&assignment=assigned`)
  await expect(page.getByRole('button', { name: 'Assigned (3)', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await capture(page, info, 'customers-mobile')
  const firstRow = await page.getByRole('row').nth(1).boundingBox()
  expect(firstRow?.height).toBeLessThan(96)
  const routeLink = page.getByRole('table').getByRole('link', { name: 'Morning Route' }).first()
  await routeLink.scrollIntoViewIfNeeded()
  await expect(routeLink).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await capture(page, info, 'customers-mobile-routes')
})

test('keyboard filters work and foreign-tenant project pages are inaccessible', async ({ page }) => {
  await page.goto(tableURL)
  await page.getByRole('button', { name: 'Unassigned (55)', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Unassigned (55)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto(`/projects/${uid(103)}?tab=customers`)
  // Next.js streams its not-found UI with HTTP 200; assert the rendered denial.
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(page.getByText('Private Project', { exact: true })).toHaveCount(0)
})
