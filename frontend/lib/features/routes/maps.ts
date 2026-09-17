import type { StopCustomer } from './types'

/** Google Maps takes an origin, a destination, and at most 9 waypoints between them. */
export const MAX_DIRECTIONS_STOPS = 11

/** Coordinates beat the address text: Google re-geocodes the string otherwise. */
function point(stop: StopCustomer) {
  if (stop.latitude !== null && stop.longitude !== null) return `${stop.latitude},${stop.longitude}`
  return [stop.address, stop.city, stop.state].filter(Boolean).join(', ')
}

/** Google Maps directions link for the stops, in order. Stops past the 11th are dropped. */
export function directionsURL(stops: StopCustomer[]) {
  const points = stops.slice(0, MAX_DIRECTIONS_STOPS).map(point)
  const params = new URLSearchParams({
    api: '1',
    origin: points[0],
    destination: points[points.length - 1],
    travelmode: 'driving',
  })
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
