'use client'

import { useEffect, useMemo, useRef } from 'react'
import { divIcon, type DivIcon, type LatLngTuple, type Map as LeafletMapInstance } from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useTheme } from '@astryxdesign/core/theme'
import type { Customer, Pinned, PinnedCustomer } from '@/lib/features/customers/types'
import { hasPin, LocationAccuracy } from '@/lib/features/customers/types'
import type { RouteDraft } from '@/lib/features/routes/types'

export const DEFAULT_CENTER: LatLngTuple = [40.7, -74.2] // NJ / NY, where the first tenant lives
export const DEFAULT_ZOOM = 8
const toLatLng = (c: Pinned): LatLngTuple => [c.latitude, c.longitude]

// Teardrop pin, tip on the coordinate. Cached per look so re-renders reuse the same
// icon object and Leaflet doesn't rebuild a thousand marker elements.
const iconCache = new Map<string, DivIcon>()
export function pinIcon(fill: string, stroke: string, size: number, opacity: number, label = '') {
  const key = [fill, stroke, size, opacity, label].join('|')
  let icon = iconCache.get(key)
  if (!icon) {
    const height = Math.round(size * 1.4)
    const text = label
      ? `<text x="10" y="10.5" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="${label.length > 1 ? 7.5 : 9}" font-weight="700">${label}</text>`
      : ''
    icon = divIcon({
      className: 'route-pin', // no default white box; hover stroke lives in globals.css
      html: `<svg width="${size}" height="${height}" viewBox="0 0 20 28" aria-hidden="true">
        <path d="M10 27C10 27 1.5 15.5 1.5 10a8.5 8.5 0 1 1 17 0C18.5 15.5 10 27 10 27z" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-linejoin="round"/>
        ${text}
      </svg>`,
      iconSize: [size, height],
      iconAnchor: [size / 2, height],
      tooltipAnchor: [0, -height],
    })
    iconCache.set(key, icon)
  }
  return icon
}

type Props = {
  customers: Customer[]
  draft: RouteDraft
  editingRouteId: string | null
  onAddStop: (customer: Customer) => void
  /** Changes when the filters change: refit to the filtered pins. */
  filtersKey: string
  /** Stops of the route that was opened; refit to them when focusNonce changes. */
  focus: Pinned[]
  focusNonce: number
}

export function LeafletMap({
  customers,
  draft,
  editingRouteId,
  onAddStop,
  filtersKey,
  focus,
  focusNonce,
}: Props) {
  const pinned = useMemo(() => customers.filter(hasPin), [customers])

  return (
    // zoomSnap 0.25: fitBounds can land between whole zoom levels, so a route fills the view.
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} zoomSnap={0.25} style={{ height: '100%', width: '100%' }}>
      <BaseTiles />
      <FitToPins pinned={pinned} filtersKey={filtersKey} focus={focus} focusNonce={focusNonce} />
      <Pins pinned={pinned} draft={draft} editingRouteId={editingRouteId} onAddStop={onAddStop} />
      {draft.stops.length > 1 && (
        <Polyline
          positions={draft.stops.filter(hasPin).map(toLatLng)}
          pathOptions={{ color: draft.color, weight: 3, dashArray: '6 6' }}
        />
      )}
    </MapContainer>
  )
}

export function BaseTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  )
}

/** One pin per customer. A click adds the stop (removal is in the list); the hover tooltip only shows details. */
function Pins({
  pinned,
  draft,
  editingRouteId,
  onAddStop,
}: Pick<Props, 'draft' | 'editingRouteId' | 'onAddStop'> & { pinned: PinnedCustomer[] }) {
  const theme = useTheme()
  const stopIndex = useMemo(() => new Map(draft.stops.map((s, i) => [s.id, i + 1])), [draft.stops])

  const neutralPin = theme.token('--color-icon-secondary')
  const pinStroke = theme.token('--color-on-dark') // white outline in both modes

  return pinned.map((c) => {
    const stopNumber = stopIndex.get(c.id)
    const otherRoute = c.route && c.route.id !== editingRouteId ? c.route : null
    return (
      <Marker
        key={c.id}
        position={toLatLng(c)}
        icon={pinIcon(
          stopNumber ? draft.color : otherRoute ? otherRoute.color : neutralPin,
          pinStroke,
          stopNumber ? 28 : 20,
          c.location_accuracy === LocationAccuracy.ZIP ? 0.55 : 1,
          stopNumber ? String(stopNumber) : '',
        )}
        eventHandlers={{ click: () => !otherRoute && !stopNumber && onAddStop(c) }}
      >
        <Tooltip direction="top" opacity={1} className="route-pin-tip">
          <VStack gap={1}>
            <VStack gap={0}>
              <Text type="label">{c.name}</Text>
              <Text type="supporting">{c.address}</Text>
              <Text type="supporting">
                {c.city}, {c.state} {c.zipcode}
              </Text>
            </VStack>
            {c.location_accuracy === LocationAccuracy.ZIP && (
              <Text type="supporting" size="sm">
                Approximate location (ZIP code only)
              </Text>
            )}
          </VStack>
        </Tooltip>
      </Marker>
    )
  })
}

/**
 * Refits the view only on a filter change or when a route is opened, never on a
 * plain re-render (saving a route must leave the map where the user put it).
 */
function FitToPins({
  pinned,
  filtersKey,
  focus,
  focusNonce,
}: {
  pinned: PinnedCustomer[]
  filtersKey: string
  focus: Pinned[]
  focusNonce: number
}) {
  const map = useMap()
  const latest = useRef({ pinned, focus })
  const applied = useRef<{ map: LeafletMapInstance; filtersKey: string; focusNonce: number } | null>(null)
  useEffect(() => {
    latest.current = { pinned, focus }
  })
  // One fitBounds per change. Leaflet silently drops a zoom requested while an earlier
  // zoom is still animating, so two fits in a row (filters, then the opened route)
  // left the map on the first one: all pins instead of the route.
  useEffect(() => {
    const prev = applied.current?.map === map ? applied.current : null
    if (prev?.filtersKey === filtersKey && prev.focusNonce === focusNonce) return // StrictMode replay
    applied.current = { map, filtersKey, focusNonce }
    const { pinned, focus } = latest.current
    // First mount: the opened route wins. Later: whatever changed, route first.
    const points = !prev ? (focus.length ? focus : pinned) : prev.focusNonce !== focusNonce ? focus : pinned
    // Pins hang above their coordinate (28px wide, ~40px tall), so the top needs room for a whole pin.
    if (points.length) {
      map.fitBounds(points.map(toLatLng), { paddingTopLeft: [32, 56], paddingBottomRight: [32, 32], maxZoom: 14 })
    }
  }, [map, filtersKey, focusNonce])
  return null
}
