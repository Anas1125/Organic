import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import api from '../api/client'

const SITE = (import.meta.env.VITE_SITE_URL || 'https://organic-bt6.pages.dev').replace(/\/$/, '')
const DEFAULT = 'Explore GI-tagged products from Tamil Nadu, including silk sarees, handicrafts and traditional foods.'
const pages = {
  '/': ['GI-Tagged Products & Wholesale', DEFAULT],
  '/shop': ['Shop GI-Tagged Products', 'Browse traditional foods, textiles and handicrafts from Tamil Nadu sellers.'],
  '/about': ['About Us', 'Learn about our marketplace for regional products and their producers.'],
  '/contact': ['Contact Us', 'Contact our marketplace team for product and wholesale enquiries.'],
}
function meta(key, value, property = false) {
  const attr = property ? 'property' : 'name'
  let node = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attr, key)
    document.head.appendChild(node)
  }
  node.content = value
}

export default function Seo() {
  const { pathname, search } = useLocation()
  const { site } = useSite()
  const path = pathname.replace(/\/$/, '') || '/'
  const dynamic = /^\/(products|sellers)\/[1-9]\d*$/.test(path)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!dynamic) return
    let active = true
    api.get(path).then(({ data }) => {
      if (active) setResult({ path, data })
    }).catch(() => { if (active) setResult({ path, failed: true }) })
    return () => { active = false }
  }, [path, dynamic])
  const current = result?.path === path ? result : null
  useEffect(() => {
    const brand = site.site_name || 'Terralens'
    const product = path.startsWith('/products/') ? current?.data : null
    const seller = path.startsWith('/sellers/') ? current?.data?.seller : null
    const [heading, summary] = pages[path] || [dynamic ? 'Marketplace' : 'Account or page not found', DEFAULT]
    const name = product?.name || seller?.business_name || heading
    const description = String(product?.description || seller?.description || summary).replace(/\s+/g, ' ').trim().slice(0, 160)
    const title = name + ' | ' + brand
    const url = SITE + path
    const indexable = Boolean(pages[path] || dynamic) && !current?.failed && !(path === '/shop' && search)
    document.title = title
    meta('description', description)
    meta('robots', indexable ? 'index, follow' : 'noindex, follow')
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url
    let img = SITE + '/hero/erode-turmeric.webp'
    const raw = product?.images?.[0]?.url || product?.images?.[0]?.image_url || product?.image
    if (typeof raw === 'string') {
      try { const candidate = new URL(raw, import.meta.env.VITE_API_URL || SITE); if (['https:', 'http:'].includes(candidate.protocol)) img = candidate.href } catch {}
    }
    for (const [key, value] of Object.entries({ 'og:title': title, 'og:description': description, 'og:url': url, 'og:type': product ? 'product' : 'website', 'og:image': img, 'og:site_name': brand })) meta(key, value, true)
    for (const [key, value] of Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': img })) meta(key, value)
    let schema = document.getElementById('seo-schema')
    if (schema) schema.remove()
    let structured
    if (path === '/') structured = { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: SITE }
    if (product && indexable) {
      structured = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description, url, sku: String(product.id), ...(raw ? { image: img } : {}), offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: String(product.price), availability: product.stock >= product.min_order_qty ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }
    }
    if (structured) {
      schema = document.createElement('script')
      schema.id = 'seo-schema'
      schema.type = 'application/ld+json'
      schema.textContent = JSON.stringify(structured)
      document.head.appendChild(schema)
    }
  }, [path, search, dynamic, current, site.site_name])
  return null
}
