import { PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCardSkeleton, ProductGrid } from '../../components/product'
import { Button, EmptyState, ErrorBox, Modal, Select } from '../../components/ui'
import useFetch from '../../hooks/useFetch'

const SORTS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name'],
]

function Filters({ params, set }) {
  const toggle = (key) => set({ [key]: params.get(key) === 'true' ? null : 'true' })
  const [min, setMin] = useState(params.get('min_price') || '')
  const [max, setMax] = useState(params.get('max_price') || '')
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Verified only</h3>
        {[
          ['organic', 'Certified organic'],
          ['gi', 'GI-tagged'],
          ['bulk', 'Bulk pricing available'],
        ].map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
            <input type="checkbox" checked={params.get(key) === 'true'} onChange={() => toggle(key)} className="size-4 rounded accent-brand-700" />
            {label}
          </label>
        ))}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold">Price (₹ per unit)</h3>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); set({ min_price: min || null, max_price: max || null }) }}
        >
          <input className="input" type="number" min="0" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input className="input" type="number" min="0" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Maximum price" />
          <Button size="sm" variant="secondary" type="submit">Go</Button>
        </form>
      </div>
    </div>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const query = Object.fromEntries(params)
  const { data: categories } = useFetch('/categories')
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
  const activeFilters = ['organic', 'gi', 'bulk', 'min_price', 'max_price', 'q'].filter((k) => params.get(k))

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{params.get('q') ? `Results for “${params.get('q')}”` : 'Fresh produce & pantry'}</h1>
          {data && <p className="mt-1 text-sm text-muted">{data.total} product{data.total === 1 ? '' : 's'}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" className="lg:hidden" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="size-4" /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
          </Button>
          <div className="w-44">
            <Select value={params.get('sort') || 'newest'} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ slug: '', name: 'All' }, ...(categories || []).filter((c) => c.product_count > 0)].map((c) => (
          <button
            key={c.slug}
            onClick={() => set({ category: c.slug || null })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCat === c.slug ? 'bg-brand-800 text-white' : 'bg-white text-ink shadow-card hover:bg-brand-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {activeFilters.map((k) => (
            <button key={k} onClick={() => set({ [k]: null })} className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
              {k === 'q' ? `“${params.get(k)}”` : k === 'min_price' ? `Min ₹${params.get(k)}` : k === 'max_price' ? `Max ₹${params.get(k)}` : { organic: 'Organic', gi: 'GI-tagged', bulk: 'Bulk pricing' }[k]}
              <X className="size-3" />
            </button>
          ))}
          <button onClick={() => setParams({})} className="px-2 text-xs font-medium text-muted underline">Clear all</button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-5"><Filters params={params} set={set} key={params.toString()} /></div>
        </aside>
        <div>
          {error ? <ErrorBox message={error} onRetry={reload} />
            : loading ? <ProductCardSkeleton />
            : !data.items.length ? (
              <div className="card">
                <EmptyState icon={PackageSearch} title="No products found" text="Try a different search or remove some filters." action={<Button variant="secondary" onClick={() => setParams({})}>Clear filters</Button>} />
              </div>
            ) : <ProductGrid products={data.items} />}

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</Button>
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              <Button variant="outline" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Next</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filters" footer={<Button onClick={() => setShowFilters(false)}>Show results</Button>}>
        <Filters params={params} set={set} key={params.toString()} />
      </Modal>
    </div>
  )
}
