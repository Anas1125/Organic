import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'

const DEFAULTS = {
  site_name: 'Terralens', tagline: null, logo_url: null,
  contact_email: null, contact_phone: null, contact_hours: null, locations: [],
}
const SiteContext = createContext({ site: DEFAULTS, setSite: () => {}, loaded: false, ready: false })

// The last settings seen are kept in the browser, so the right logo and name show
// instantly on the next visit instead of flashing the default leaf.
const CACHE_KEY = 'terralens_site'
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null } }
const writeCache = (s) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)) } catch { /* private mode */ } }

/** Brand settings (name, tagline, logo) managed from Admin → Site settings. */
export function SiteProvider({ children }) {
  const [cached] = useState(readCache)
  const [site, setSiteState] = useState(() => (cached ? { ...DEFAULTS, ...cached } : { ...DEFAULTS, site_name: '' }))
  const [loaded, setLoaded] = useState(false)
  // ready: we know the real brand (from the server, or from the last visit).
  const ready = loaded || Boolean(cached)

  const setSite = (value) => setSiteState((prev) => {
    const next = typeof value === 'function' ? value(prev) : value
    writeCache(next)
    return next
  })

  useEffect(() => {
    api.get('/site-settings')
      .then((r) => setSite(r.data))
      .catch(() => setSiteState((prev) => (prev.site_name ? prev : DEFAULTS))) // offline first visit
      .finally(() => setLoaded(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Browser-tab icon follows the logo uploaded in Admin → Site settings (default: the leaf).
  useEffect(() => {
    if (!ready) return
    const href = site.logo_url || '/leaf.svg'
    let link = document.querySelector("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = href.endsWith('.svg') ? 'image/svg+xml' : 'image/webp'
    link.href = href
    let apple = document.querySelector("link[rel='apple-touch-icon']")
    if (!apple) {
      apple = document.createElement('link')
      apple.rel = 'apple-touch-icon'
      document.head.appendChild(apple)
    }
    apple.href = href
  }, [site.logo_url, ready])

  return <SiteContext.Provider value={{ site, setSite, loaded, ready }}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
