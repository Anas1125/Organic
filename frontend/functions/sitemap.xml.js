// Cloudflare Pages Function: live public catalogue, never private dashboard data.
const SITE = 'https://organic-bt6.pages.dev'
const API = 'https://organic-nine-hazel.vercel.app/api/v1'
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

export async function onRequestGet({ env }) {
  const origin = (env.PUBLIC_SITE_URL || SITE).replace(/\/$/, '')
  const api = (env.PUBLIC_API_URL || API).replace(/\/$/, '')
  const paths = new Set(['/', '/shop', '/about', '/contact'])
  try {
    let page = 1
    while (true) {
      const response = await fetch(`${api}/products?page=${page}&page_size=60`, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('Catalogue unavailable')
      const { items, total } = await response.json()
      if (!Array.isArray(items) || !Number.isFinite(total)) throw new Error('Invalid catalogue')
      for (const product of items) {
        if (Number.isSafeInteger(product.id) && product.id > 0) paths.add('/products/' + product.id)
        if (Number.isSafeInteger(product.seller?.id) && product.seller.id > 0) paths.add('/sellers/' + product.seller.id)
      }
      if (paths.size > 50000) throw new Error('Sitemap requires splitting')
      if (page * 60 >= total) break
      if (!items.length || page >= 1000) throw new Error('Incomplete catalogue')
      page++
    }
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      [...paths].map(path => '  <url><loc>' + xml(origin + path) + '</loc></url>').join('\n') + '\n</urlset>\n'
    return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } })
  } catch {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } })
  }
}
