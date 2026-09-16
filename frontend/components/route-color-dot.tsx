import type { SVGProps } from 'react'
import { Icon } from '@astryxdesign/core/Icon'

function Circle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="8" cy="8" r="8" />
    </svg>
  )
}

/** Swatch for a route's user-chosen color. That color is data, not a theme token. */
export function RouteColorDot({ color }: { color: string }) {
  return <Icon icon={Circle} size="sm" style={{ color }} />
}
