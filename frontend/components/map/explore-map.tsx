'use client'

import { useEffect } from 'react'
import { MapContainer, Marker, Tooltip, useMap } from 'react-leaflet'
import { useTheme } from '@astryxdesign/core/theme'
import type { Place } from '@/lib/features/places/types'
import { BaseTiles, DEFAULT_CENTER, DEFAULT_ZOOM, pinIcon } from './leaflet-map'

/** Plain map with at most one searched place on it. */
export function ExploreLeafletMap({ place, zoom }: { place: Place | null; zoom: number }) {
  const theme = useTheme()
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
      <BaseTiles />
      <FlyTo place={place} zoom={zoom} />
      {place && (
        <Marker
          position={[place.latitude, place.longitude]}
          icon={pinIcon(theme.token('--color-accent'), theme.token('--color-on-dark'), 28, 1)}
          title={place.label}
        >
          <Tooltip direction="top" opacity={1} className="route-pin-tip" permanent>
            {place.label}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}

function FlyTo({ place, zoom }: { place: Place | null; zoom: number }) {
  const map = useMap()
  const lat = place?.latitude
  const lng = place?.longitude
  useEffect(() => {
    if (lat === undefined || lng === undefined) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    else map.flyTo([lat, lng], zoom)
  }, [map, lat, lng, zoom])
  return null
}
