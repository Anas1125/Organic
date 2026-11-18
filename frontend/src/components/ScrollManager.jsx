import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const saved = new Map() // location.key -> scrollY
let currentKey = null // the page currently on screen

function snapshot() {
  if (currentKey) saved.set(currentKey, window.scrollY)
}

/**
 * New pages start at the top; Back/Forward returns to where you were on that page.
 * Pages load their data after they appear, so the saved position is re-applied until
 * the page is tall enough (up to ~2.5 seconds) instead of letting the browser guess.
 */
export default function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    try { window.history.scrollRestoration = 'manual' } catch { /* old browsers */ }
    // Save the position while scrolling, and again right before leaving the page:
    // on any click (links) and on Back/Forward — both happen before the new page renders.
    window.addEventListener('scroll', snapshot, { passive: true })
    document.addEventListener('click', snapshot, true)
    window.addEventListener('popstate', snapshot, true)
    return () => {
      window.removeEventListener('scroll', snapshot)
      document.removeEventListener('click', snapshot, true)
      window.removeEventListener('popstate', snapshot, true)
    }
  }, [])

  useLayoutEffect(() => {
    currentKey = location.key
    const target = navType === 'POP' ? saved.get(location.key) ?? 0 : 0
    if (!target) {
      window.scrollTo(0, 0)
      return undefined
    }
    let timer
    let cancelled = false
    const started = Date.now()
    const tryRestore = () => {
      if (cancelled) return
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target
      window.scrollTo(0, target)
      if (!reachable && Date.now() - started < 2500) timer = setTimeout(tryRestore, 50)
    }
    tryRestore()
    // Stop if the visitor starts scrolling themselves.
    const stop = () => { cancelled = true }
    window.addEventListener('wheel', stop, { passive: true, once: true })
    window.addEventListener('touchstart', stop, { passive: true, once: true })
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
    }
  }, [location.key, navType])

  return null
}
