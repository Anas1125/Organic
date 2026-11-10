import { BadgeCheck, Leaf, MapPin, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { money } from '../lib/format'
import { CategoryIcon, categoryLook } from './Brand'

export function ProductImage({ product, src, className = '', iconSize = 'size-14' }) {
  const url = src ?? product?.images?.[0]?.url
  const { bg } = categoryLook(product?.category?.slug)
  if (url) return <img src={url} alt={product?.name || ''} className={`h-full w-full object-cover ${className}`} loading="lazy" />
  return (
    <div className={`grid h-full w-full place-items-center ${className}`} style={{ background: bg }}>
      <CategoryIcon slug={product?.category?.slug} className={`${iconSize} opacity-80`} />
    </div>
  )
}

export function OrganicBadge({ small }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-brand-100 font-semibold text-brand-700 ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <Leaf className="size-3" /> Organic
    </span>
  )
}

export function GIBadge({ small }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-50 font-semibold text-amber-800 ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <BadgeCheck className="size-3" /> GI Tagged
    </span>
  )
}

/** Adds to cart, sending visitors to login first. Returns a click handler. */
export function useAddToCart() {
  const { user } = useAuth()
  const { add, cart, setCart } = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState('')

  const canBuy = (product) => {
    if (!user) {
      navigate('/login', { state: { from: `/products/${product.id}` } })
      return false
    }
    if (user.role !== 'buyer') {
      toast.error('Only buyer accounts can place orders')
      return false
    }
    return true
  }

  const addToCart = async (product, qty) => {
    if (!canBuy(product)) return
    setBusy('cart')
    try {
      await add(product.id, qty)
      toast.success(`${product.name} added to cart`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  /** Put exactly this quantity in the cart and go straight to checkout. */
  const buyNow = async (product, qty) => {
    if (!canBuy(product)) return
    setBusy('buy')
    try {
      const existing = cart?.groups?.flatMap((g) => g.items).find((it) => it.product.id === product.id)
      if (existing) setCart((await api.patch(`/cart/items/${existing.id}`, { quantity: qty })).data)
      else await add(product.id, qty)
      navigate('/cart', { state: { checkout: true } })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }
  return { addToCart, buyNow, busy: busy === 'cart', buying: busy === 'buy' }
}

export function ProductCard({ product }) {
  const { addToCart, busy } = useAddToCart()
  const out = product.stock < product.min_order_qty
  return (
    <div className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/products/${product.id}`} className="relative block aspect-[4/3.4] overflow-hidden bg-canvas">
        <ProductImage product={product} className="transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {product.is_organic_verified && <OrganicBadge small />}
          {product.is_gi_verified && <GIBadge small />}
        </div>
        {product.price_tiers.length > 0 && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-brand-800 backdrop-blur">
            Bulk deals
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link to={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-brand-700 sm:text-[15px]">
          {product.name}
        </Link>
        <Link to={`/sellers/${product.seller.id}`} className="mt-0.5 truncate text-xs text-muted hover:text-brand-700">
          {product.seller.business_name}
        </Link>
        {product.origin && (
          <div className="mt-1 hidden items-center gap-1 truncate text-xs text-muted sm:flex">
            <MapPin className="size-3 shrink-0" /> {product.origin}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <span className="text-base font-bold text-brand-800">{money(product.price)}</span>
            <span className="text-xs text-muted"> /{product.unit}</span>
            {product.min_order_qty > 1 && <div className="text-[11px] text-muted">Min {product.min_order_qty} {product.unit}</div>}
          </div>
          <button
            onClick={() => addToCart(product, product.min_order_qty)}
            disabled={busy || out}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-800 text-white shadow-sm transition hover:bg-brand-900 disabled:opacity-40"
            aria-label={`Add ${product.name} to cart`}
            title={out ? 'Out of stock' : 'Add to cart'}
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}

export function ProductCardSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-[4/3.4] bg-brand-50" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 rounded bg-brand-50" />
            <div className="h-3 w-1/2 rounded bg-brand-50" />
            <div className="h-5 w-1/3 rounded bg-brand-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function QuantityStepper({ value, onChange, min = 1, max = 999999, unit }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, Number.isFinite(v) ? v : min)))
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white">
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        onBlur={(e) => set(parseInt(e.target.value, 10))}
        className="w-14 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      {unit && <span className="-ml-1 pr-1 text-xs text-muted">{unit}</span>}
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} className="grid size-10 place-items-center rounded-full disabled:opacity-30" aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function PriceTiers({ product, qty }) {
  if (!product.price_tiers.length) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center gap-2 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800">
        <ShoppingBag className="size-4" /> Bulk pricing
      </div>
      <table className="w-full text-sm">
        <tbody>
          {product.price_tiers.map((t) => {
            const active = qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty)
            return (
              <tr key={t.id} className={`border-t border-line ${active ? 'bg-brand-100/60 font-semibold' : ''}`}>
                <td className="px-4 py-2.5">
                  {t.max_qty ? `${t.min_qty}–${t.max_qty}` : `${t.min_qty}+`} {product.unit}
                </td>
                <td className="px-4 py-2.5 text-right">{money(t.unit_price)}/{product.unit}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
