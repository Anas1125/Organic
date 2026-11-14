import { BadgeCheck, Layers, MapPin, PackageSearch, Scale, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CategoryIcon, categoryLook } from '../../components/Brand'
import { ProductCardSkeleton, ProductGrid } from '../../components/product'
import { Button, EmptyState, ErrorBox, Modal, Select } from '../../components/ui'
import useFetch from '../../hooks/useFetch'

const SORTS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name A–Z'],
]

const TOGGLES = [
  ['gi', 'GI-tagged', BadgeCheck],
  ['bulk', 'Bulk pricing', Scale],
  ['organic', 'Certified organic', Layers],
]

function Filters({ params, set, districts }) {
  const toggle = (key) => set({ [key]: params.get(key) === 'true' ? null : 'true' })
  const [min, setMin] = useState(params.get('min_price') || '')
  const [max, setMax] = useState(params.get('max_price') || '')
  const district = params.get('district') || ''

  return (
    <div className="space-y-7">
      {districts?.length > 0 && (
        <div>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold"><MapPin className="size-4 text-brand-700" /> District of origin</h3>
          <Select value={district} onChange={(e) => set({ district: e.target.value || null })} aria-label="District">
            <option value="">All districts</option>
            {districts.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.product_count})</option>)}
          </Select>
        </div>
      )}

      <div>
        <h3 className="mb-2.5 text-sm font-semibold">Show only</h3>
        <div className="space-y-2">
          {TOGGLES.map(([key, label, Icon]) => {
            const on = params.get(key) === 'true'
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={on}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  on ? 'border-brand-700 bg-brand-50 font-semibold text-brand-800' : 'border-line bg-white hover:border-brand-300'
                }`}
              >
                <Icon className={`size-4 ${on ? 'text-brand-700' : 'text-muted'}`} />
                <span className="flex-1">{label}</span>
                <span className={`grid size-4 place-items-center rounded border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-line'}`}>
                  {on && <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 text-sm font-semibold">Price per unit</h3>
        <form
          className="space-y-2.5"
          onSubmit={(e) => { e.preventDefault(); set({ min_price: min || null, max_price: max || null }) }}
        >
          <div className="grid grid-cols-2 gap-2">
            {[['Min', min, setMin], ['Max', max, setMax]].map(([label, value, setter]) => (
              <label key={label} className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                <input
                  className="input no-spin w-full pl-7"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder={label}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  aria-label={`${label}imum price`}
                />
              </label>
            ))}
          </div>
          <Button size="sm" variant="secondary" type="submit" className="w-full">Apply price</Button>
        </form>
      </div>
    </div>
  )
}

function ShopHeader({ category, query, total, district }) {
  const look = categoryLook(category?.slug)
  const title = query ? `Results for “${query}”` : category ? category.name : district ? `${district} GI products` : 'All GI products'
  const text = query
    ? 'Matching products, sellers and places of origin.'
    : category?.description || 'Authentic Geographical Indication products from across Tamil Nadu, sold wholesale by verified sellers.'
  return (
    <div className="relative mb-6 overflow-hidden rounded-[28px] bg-brand-900 px-6 py-7 text-white sm:px-9 sm:py-9">
      <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-20 right-24 size-40 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-5">
        <div className="hidden size-16 shrink-0 place-items-center rounded-2xl sm:grid" style={{ background: look.bg }}>
          <CategoryIcon slug={category?.slug} className="size-8" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
            {district ? `${district} district` : 'Tamil Nadu · GI-tagged · Wholesale'}
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-100/80 sm:text-base">{text}</p>
        </div>
      </div>
      {total != null && (
        <div className="relative mt-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
          {total} product{total === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const query = Object.fromEntries(params)
  const { data: categories } = useFetch('/categories')
  const { data: districts } = useFetch('/products/districts')
  const { data, loading, error, reload } = useFetch('/products', { page_size: 12, ...query })

  const set = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const page = Number(params.get('page') || 1)
  const pages = data ? Math.ceil(data.total / data.page_size) : 0
  const activeCat = params.get('category') || ''
  const category = categories?.find((c) => c.slug === activeCat)
  const shown = (categories || []).filter((c) => c.product_count > 0)
  const allCount = shown.reduce((n, c) => n + c.product_count, 0)
  const activeFilters = ['district', 'gi', 'bulk', 'organic', 'min_price', 'max_price', 'q'].filter((k) => params.get(k))
  const label = (k) => ({
    q: `“${params.get('q')}”`,
    district: params.get('district'),
    min_price: `Min ₹${params.get('min_price')}`,
    max_price: `Max ₹${params.get('max_price')}`,
    organic: 'Organic',
    gi: 'GI-tagged',
    bulk: 'Bulk pricing',
  }[k])

  return (
    <div className="container-page py-6 sm:py-8">
      <ShopHeader category={category} query={params.get('q')} total={data?.total} district={params.get('district')} />

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ slug: '', name: 'All', product_count: allCount }, ...shown].map((c) => {
          const on = activeCat === c.slug
          return (
            <button
              key={c.slug}
              onClick={() => set({ category: c.slug || null })}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-medium transition ${
                on ? 'bg-brand-800 text-white shadow-lift' : 'bg-white text-ink shadow-card hover:-translate-y-0.5'
              }`}
            >
              <span className="grid size-7 place-items-center rounded-full" style={{ background: on ? 'rgba(255,255,255,.15)' : categoryLook(c.slug).bg }}>
                {c.slug ? <CategoryIcon slug={c.slug} className={`size-4 ${on ? '!text-white' : ''}`} /> : <Layers className={`size-4 ${on ? 'text-white' : 'text-brand-700'}`} />}
              </span>
              {c.name}
              <span className={`text-xs ${on ? 'text-white/70' : 'text-muted'}`}>{c.product_count}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5">
            <Filters params={params} set={set} districts={districts} key={params.toString()} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters(true)}>
                <SlidersHorizontal className="size-4" /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
              </Button>
              {activeFilters.map((k) => (
                <button key={k} onClick={() => set({ [k]: null })} className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-200">
                  {label(k)} <X className="size-3" />
                </button>
              ))}
              {activeFilters.length > 1 && <button onClick={() => setParams(activeCat ? { category: activeCat } : {})} className="px-1 text-xs font-medium text-muted underline">Clear all</button>}
            </div>
            <div className="w-48">
              <Select value={params.get('sort') || 'newest'} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          </div>

          {error ? <ErrorBox message={error} onRetry={reload} />
            : loading ? <ProductCardSkeleton count={6} />
            : !data.items.length ? (
              <div className="card">
                <EmptyState icon={PackageSearch} title="No products found" text="Try a different search or remove some filters." action={<Button variant="secondary" onClick={() => setParams({})}>Clear filters</Button>} />
              </div>
            ) : <ProductGrid products={data.items} narrow />}

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</Button>
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              <Button variant="outline" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Next</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filters" footer={<Button onClick={() => setShowFilters(false)}>Show {data?.total ?? ''} results</Button>}>
        <Filters params={params} set={set} districts={districts} key={params.toString()} />
      </Modal>
    </div>
  )
}
