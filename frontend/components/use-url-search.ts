'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** Search box text mirrored into `?q=` (debounced); `search` is the current `?q=`. */
export function useUrlSearch(search: string) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isSearching, startSearch] = useTransition()
  const [text, setText] = useState(search)
  const appliedSearch = useRef(search)

  const applySearch = useCallback(
    (q: string) => {
      appliedSearch.current = q
      const params = new URLSearchParams(searchParams)
      if (q) params.set('q', q)
      else params.delete('q')
      params.delete('page') // a new search starts from the first page
      startSearch(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }))
    },
    [pathname, router, searchParams],
  )

  // Debounce typing into the URL.
  useEffect(() => {
    if (text === appliedSearch.current) return
    const timer = setTimeout(() => applySearch(text), 300)
    return () => clearTimeout(timer)
  }, [text, applySearch])

  // Someone else changed the URL (e.g. back button): follow it.
  useEffect(() => {
    if (search !== appliedSearch.current) {
      appliedSearch.current = search
      setText(search)
    }
  }, [search])

  function clear() {
    setText('')
    applySearch('')
  }

  return { text, setText, clear, isSearching }
}
