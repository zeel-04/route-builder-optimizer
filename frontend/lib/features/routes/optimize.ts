import type { StopCustomer } from './types'

type Point = { latitude: number; longitude: number }

/** Great-circle distance in km. */
function distance(a: Point, b: Point) {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function routeKm(all: StopCustomer[]) {
  const stops = all.filter((s): s is StopCustomer & Point => s.latitude !== null && s.longitude !== null)
  let km = 0
  for (let i = 1; i < stops.length; i++) km += distance(stops[i - 1], stops[i])
  return km
}

/**
 * Reorders stops into a short one-way path that keeps the first stop fixed:
 * nearest-neighbour, then 2-opt. Stops without coordinates go to the end.
 * ponytail: straight-line distance, O(n²) per pass; switch to a road-distance matrix if drivers need it.
 */
export function optimizeStops<T extends StopCustomer>(stops: T[]): T[] {
  type Located = T & Point
  const located = stops.filter((s): s is Located => s.latitude !== null && s.longitude !== null)
  const unlocated = stops.filter((s) => s.latitude === null || s.longitude === null)
  if (located.length < 3) return stops

  const pool = located.slice(1)
  const out: Located[] = [located[0]]
  while (pool.length) {
    const last = out[out.length - 1]
    let best = 0
    for (let i = 1; i < pool.length; i++) {
      if (distance(last, pool[i]) < distance(last, pool[best])) best = i
    }
    out.push(pool.splice(best, 1)[0])
  }

  let improved = true
  for (let pass = 0; improved && pass < 40; pass++) {
    improved = false
    for (let i = 1; i < out.length - 2; i++) {
      for (let j = i + 1; j < out.length - 1; j++) {
        const before = distance(out[i - 1], out[i]) + distance(out[j], out[j + 1])
        const after = distance(out[i - 1], out[j]) + distance(out[i], out[j + 1])
        if (after < before - 1e-4) {
          out.splice(i, j - i + 1, ...out.slice(i, j + 1).reverse())
          improved = true
        }
      }
    }
  }

  return [...out, ...unlocated]
}
