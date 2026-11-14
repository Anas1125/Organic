import { BadgeCheck, ChevronLeft, Leaf, MapPin, Package, ShoppingCart, Store, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import { GIBadge, OrganicBadge, PriceTiers, ProductCardSkeleton, ProductGrid, ProductImage, QuantityStepper, useAddToCart } from '../../components/product'
import { Button, EmptyState, Spinner } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { GI_TYPES, date, money, unitPriceFor } from '../../lib/format'
import { useSite } from '../../context/SiteContext'

export default function ProductDetail() {
  const { site } = useSite()
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: p, loading, error } = useFetch(`/products/${id}`)
  const [qty, setQty] = useState(1)
  const [img, setImg] = useState(0)
  const { addToCart, buyNow, busy, buying } = useAddToCart()

  useEffect(() => { if (p) { setQty(p.min_order_qty); setImg(0) } }, [p])

  if (loading) return <Spinner className="min-h-[60vh]" />
  if (error || !p) {
    return (
      <div className="container-page py-10">
        <div className="card"><EmptyState icon={Package} title="Product not available" text={error} action={<Button to="/shop">Back to shop</Button>} /></div>
      </div>
    )
  }

  const unitPrice = unitPriceFor(p, qty)
  const total = unitPrice * qty
  const saving = (Number(p.price) - unitPrice) * qty
  const out = p.stock < p.min_order_qty

  return (
    <div className="container-page py-5 sm:py-8">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Back
      </button>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="card aspect-square overflow-hidden">
            <ProductImage product={p} src={p.images[img]?.url ?? null} iconSize="size-28" />
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {p.images.map((im, i) => (
                <button key={im.id} onClick={() => setImg(i)} className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 sm:size-20 ${i === img ? 'border-brand-700' : 'border-transparent'}`}>
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/shop?category=${p.category.slug}`} className="rounded-full bg-white px-3 py-1 text-xs font-medium shadow-card">{p.category.name}</Link>
            {p.is_organic_verified && <OrganicBadge />}
            {p.is_gi_verified && <GIBadge />}
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{p.name}</h1>
          <Link to={`/sellers/${p.seller.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <Store className="size-4" /> {p.seller.business_name}
          </Link>
          {p.origin && <div className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" /> {p.origin}</div>}

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-brand-800">{money(unitPrice)}</span>
            <span className="text-muted">/ {p.unit}</span>
            {unitPrice < Number(p.price) && <span className="text-sm text-muted line-through">{money(p.price)}</span>}
          </div>
          <div className="mt-1 text-sm text-muted">
            {out ? <span className="font-semibold text-red-600">Out of stock</span> : <>{p.stock} {p.unit} in stock</>}
            {p.min_order_qty > 1 && <> · Minimum order {p.min_order_qty} {p.unit}</>}
          </div>

          <div className="mt-6 space-y-4">
            <PriceTiers product={p} qty={qty} />
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <QuantityStepper value={qty} onChange={setQty} min={p.min_order_qty} max={Math.max(p.stock, p.min_order_qty)} unit={p.unit} />
                <div className="text-right">
                  <div className="text-xs text-muted">Total</div>
                  <div className="text-xl font-bold">{money(total)}</div>
                  {saving > 0 && <div className="text-xs font-semibold text-brand-600">You save {money(saving)}</div>}
                </div>
              </div>
              <Button size="lg" className="mt-4 w-full" loading={busy} disabled={out || buying || qty < p.min_order_qty || qty > p.stock} onClick={() => addToCart(p, qty)}>
                <ShoppingCart className="size-5" /> Add to cart
              </Button>
              <Button size="lg" variant="outline" className="mt-2.5 w-full" loading={buying} disabled={out || busy || qty < p.min_order_qty || qty > p.stock} onClick={() => buyNow(p, qty)}>
                <Zap className="size-5" /> Buy now
              </Button>
            </div>
          </div>

          {p.description && (
            <div className="mt-8">
              <h2 className="mb-2 font-semibold">About this product</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{p.description}</p>
            </div>
          )}

          {(p.organic || p.gi) && (
            <div className="mt-8 space-y-3">
              <h2 className="font-semibold">Verified certifications</h2>
              {p.organic && (
                <div className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm">
                  <Leaf className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <div>
                    <div className="font-semibold">{p.organic.certification_type}</div>
                    <div className="text-muted">No. {p.organic.certification_number} · {p.organic.issuing_authority}</div>
                    {p.organic.expiry_date && <div className="text-muted">Valid until {date(p.organic.expiry_date)}</div>}
                  </div>
                </div>
              )}
              {p.gi && (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
                  <div>
                    <div className="font-semibold">{p.gi.gi_product_name}</div>
                    <div className="text-muted">{GI_TYPES[p.gi.record_type]} · {p.gi.geographical_region}</div>
                    {p.gi.registration_number && <div className="text-muted">{/^GI /.test(p.gi.registration_number) ? '' : 'Reg. no. '}{p.gi.registration_number}</div>}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted">Checked by the {site.site_name} team against documents submitted by the seller.</p>
            </div>
          )}
        </div>
      </div>

      <SuggestedProducts product={p} />
    </div>
  )
}

/** Up to 4 other products: same category first, then the newest from elsewhere. */
function SuggestedProducts({ product }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    Promise.all([
      api.get('/products', { params: { category: product.category.slug, page_size: 9 } }),
      api.get('/products', { params: { page_size: 12 } }),
    ])
      .then(([same, newest]) => {
        const seen = new Set([product.id])
        const pick = []
        for (const p of [...same.data.items, ...newest.data.items]) {
          if (!seen.has(p.id) && pick.length < 4) { seen.add(p.id); pick.push(p) }
        }
        if (alive) setItems(pick)
      })
      .catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [product.id, product.category.slug])

  if (items && !items.length) return null
  return (
    <section className="mt-12 sm:mt-16">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold sm:text-2xl">You may also like</h2>
        <Link to={`/shop?category=${product.category.slug}`} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">More {product.category.name}</Link>
      </div>
      {items ? <ProductGrid products={items} /> : <ProductCardSkeleton count={4} />}
    </section>
  )
}
