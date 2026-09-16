'use client'

import Link from 'next/link'
import { LayerProvider } from '@astryxdesign/core/Layer'
import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={neutralTheme}>
      {/* Top so toasts never cover the route builder's footer actions. */}
      <LayerProvider toast={{ position: 'topEnd' }}>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </LayerProvider>
    </Theme>
  )
}
