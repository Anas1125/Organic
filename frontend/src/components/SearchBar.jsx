import { Leaf, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { money } from '../lib/format'
import { CategoryIcon, categoryLook } from './Brand'

/** Bold the part of `text` that matches what the user typed. */
function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (!query || i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-bold text-brand-800">{text.slice(i, i + query.length)}</strong>
      {text.slice(i + query.length)}
    </>
  )
}

export default function SearchBar({ className = '', autoFocus }) {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const listId = useId()
  const boxRef = useRef(null)
  const requestRef = useRef(0)

  const [q, setQ] = useState(params.get('q') || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({ products: [], categories: [] })
  const [active, setActive] = useState(-1)

  useEffect(() => { setQ(params.get('q') || '') }, [params])
  useEffect(() => { setOpen(false) }, [pathname, params])

  // Fetch suggestions 200 ms after the user stops typing; ignore out-of-order replies.
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults({ products: [], categories: [] })
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const id = ++requestRef.current
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/products/suggest', { params: { q: term, limit: 6 } })
        if (id === requestRef.current) setResults(data)
      } catch {
        if (id === requestRef.current) setResults({ products: [], categories: [] })
      } finally {
        if (id === requestRef.current) setLoading(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const term = q.trim()
  // One flat list so arrow keys move through categories, products and "search all".
  const options = [
    ...results.categories.map((c) => ({ key: `c${c.slug}`, to: `/shop?category=${c.slug}`, kind: 'category', item: c })),
    ...results.products.map((p) => ({ key: `p${p.id}`, to: `/products/${p.id}`, kind: 'product', item: p })),
    ...(term ? [{ key: 'all', to: `/shop?q=${encodeURIComponent(term)}`, kind: 'all' }] : []),
  ]
  useEffect(() => { setActive(-1) }, [results])

  const go = (to) => {
    setOpen(false)
    navigate(to)
  }

  const onKeyDown = (e) => {
    if (!open || !options.length) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      go(options[active].to)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    go(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  const showPanel = open && term.length > 0
  const empty = !loading && !results.products.length && !results.categories.length

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          placeholder="Search rice, millets, karuvadu, spices…"
          className="h-11 w-full rounded-full border border-transparent bg-canvas pl-11 pr-10 text-sm outline-none transition focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100"
          aria-label="Search products"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line">
          <ul id={listId} role="listbox" className="max-h-[70vh] overflow-y-auto py-2">
            {empty && <li className="px-4 py-3 text-sm text-muted">No products match “{term}”.</li>}
            {options.map((o, i) => {
              const cls = `flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm ${i === active ? 'bg-brand-50' : 'hover:bg-brand-50/60'}`
              const props = {
                id: `${listId}-${i}`,
                role: 'option',
                'aria-selected': i === active,
                className: cls,
                onMouseEnter: () => setActive(i),
                onMouseDown: (e) => { e.preventDefault(); go(o.to) },
              }
              if (o.kind === 'category') {
                return (
                  <li key={o.key} {...props}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: categoryLook(o.item.slug).bg }}>
                      <CategoryIcon slug={o.item.slug} className="size-4" />
                    </span>
                    <span className="flex-1"><Highlight text={o.item.name} query={term} /></span>
                    <span className="text-xs text-muted">Category</span>
                  </li>
                )
              }
              if (o.kind === 'product') {
                const p = o.item
                return (
                  <li key={o.key} {...props}>
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: categoryLook(p.category_slug).bg }}>
                      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <CategoryIcon slug={p.category_slug} className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate"><Highlight text={p.name} query={term} /></span>
                        {p.is_organic_verified && <Leaf className="size-3.5 shrink-0 text-brand-600" aria-label="Certified organic" />}
                      </span>
                      <span className="block truncate text-xs text-muted">{p.seller}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-brand-800">{money(p.price)}<span className="text-xs font-normal text-muted">/{p.unit}</span></span>
                  </li>
                )
              }
              return (
                <li key={o.key} {...props} className={`${cls} border-t border-line font-medium text-brand-800`}>
                  <Search className="size-4" /> Search all products for “{term}”
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
