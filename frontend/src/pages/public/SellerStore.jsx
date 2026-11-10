import { BadgeCheck, Leaf, MapPin, Package, Store } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ProductGrid } from '../../components/product'
import { Button, EmptyState, Spinner } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { date } from '../../lib/format'

export default function SellerStore() {
  const { id } = useParams()
  const { data, loading, error } = useFetch(`/sellers/${id}`)
  if (loading) return <Spinner className="min-h-[60vh]" />
  if (error) {
    return <div className="container-page py-10"><div className="card"><EmptyState icon={Store} title="Seller not found" text={error} action={<Button to="/shop">Back to shop</Button>} /></div></div>
  }
  const { seller, products } = data
  return (
    <div className="container-page py-6 sm:py-8">
      <div className="overflow-hidden rounded-[28px] bg-brand-100">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand-800 text-3xl font-bold text-white">
            {seller.business_name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">{seller.business_name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-800/70">
              {(seller.city || seller.state) && <span className="flex items-center gap-1"><MapPin className="size-4" />{[seller.city, seller.state].filter(Boolean).join(', ')}</span>}
              <span>Selling since {date(seller.created_at)}</span>
            </div>
            {seller.description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-900/80">{seller.description}</p>}
          </div>
          <div className="flex gap-3 sm:flex-col">
            <div className="rounded-2xl bg-white px-4 py-3 text-center"><div className="text-xl font-bold">{products.length}</div><div className="text-xs text-muted">Products</div></div>
          </div>
        </div>
        {(data.verified_organic > 0 || data.verified_gi > 0) && (
          <div className="flex flex-wrap gap-4 border-t border-brand-200 bg-brand-50/60 px-6 py-3 text-sm sm:px-8">
            {data.verified_organic > 0 && <span className="flex items-center gap-1.5 font-medium text-brand-800"><Leaf className="size-4" /> {data.verified_organic} certified organic</span>}
            {data.verified_gi > 0 && <span className="flex items-center gap-1.5 font-medium text-amber-800"><BadgeCheck className="size-4" /> {data.verified_gi} GI-tagged</span>}
          </div>
        )}
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold">Products</h2>
      {products.length ? <ProductGrid products={products} /> : <div className="card"><EmptyState icon={Package} title="No products yet" /></div>}
    </div>
  )
}
