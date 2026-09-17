import type { StopCustomer } from './types'

const COLUMNS: [string, (stop: StopCustomer, index: number) => unknown][] = [
  ['Stop', (_, i) => i + 1],
  ['Customer code', (s) => s.customer_code],
  ['Name', (s) => s.name],
  ['Address', (s) => [s.address, s.address2].filter(Boolean).join(' ')],
  ['City', (s) => s.city],
  ['County', (s) => s.county],
  ['State', (s) => s.state],
  ['ZIP', (s) => s.zipcode],
  ['Latitude', (s) => s.latitude],
  ['Longitude', (s) => s.longitude],
  ['Pin accuracy', (s) => s.location_accuracy],
]

function cell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function stopsToCSV(stops: StopCustomer[]) {
  const rows = [COLUMNS.map(([header]) => header), ...stops.map((s, i) => COLUMNS.map(([, read]) => cell(read(s, i))))]
  return rows.map((row) => row.join(',')).join('\n')
}

/** Browser-only: hands the CSV to the user as a file download. */
export function downloadCSV(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'route'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
