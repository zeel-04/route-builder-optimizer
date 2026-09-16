'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@astryxdesign/core/Skeleton'

// Leaflet touches `window` at import time, so it only loads in the browser.
export const CustomerMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <Skeleton radius="none" />,
})
