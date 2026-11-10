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
    document.title = `${site.site_name} — Organic & Traditional Food Marketplace`
  }, [site.site_name])

  return <SiteContext.Provider value={{ site, setSite, loaded }}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
