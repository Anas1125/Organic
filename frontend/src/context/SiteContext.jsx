import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'

const DEFAULTS = {
  site_name: 'Terralens', tagline: null, logo_url: null,
  contact_email: null, contact_phone: null, contact_hours: null, locations: [],
}
const SiteContext = createContext({ site: DEFAULTS, setSite: () => {}, loaded: false })

/** Brand settings (name, tagline, logo) managed from Admin → Site settings. */
export function SiteProvider({ children }) {
  const [site, setSite] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.get('/site-settings')
      .then((r) => setSite(r.data))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    document.title = `${site.site_name} — GI-Tagged Products, Wholesale`
  }, [site.site_name])

  // Browser-tab icon follows the logo uploaded in Admin → Site settings (default: the leaf).
  useEffect(() => {
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
  }, [site.logo_url])

  return <SiteContext.Provider value={{ site, setSite, loaded }}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
