import type { TablePlugin } from '@astryxdesign/core/Table'

/**
 * Astryx Table has no row link: the whole row opens `href(row)`, while the name
 * cell stays a real link for keyboard and new-tab use.
 */
export function tableRowLink<T extends Record<string, unknown>>(push: (href: string) => void, href: (row: T) => string): TablePlugin<T> {
  return {
    transformBodyRow: (props, row) => ({
      ...props,
      htmlProps: {
        ...props.htmlProps,
        style: { ...props.htmlProps.style, cursor: 'pointer' },
        onClick: (event) => {
          const target = event.target as Element
          // Skip the name link, the ⋯ menu, and anything portaled out of the row
          // (menu items, hover cards) whose clicks still bubble through React.
          if (!event.currentTarget.contains(target) || target.closest('a, button, [role="menuitem"]')) return
          push(href(row))
        },
      },
    }),
  }
}
