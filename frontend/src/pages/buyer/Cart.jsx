import { AlertTriangle, ShoppingCart, Store, Trash2, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { ProductImage, QuantityStepper } from '../../components/product'
import { Button, EmptyState, ErrorBox, Field, Input, Spinner, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { money } from '../../lib/format'

function CartLine({ item, onChange }) {
  const { setCart } = useCart()
  const toast = useToast()
  const [qty, setQty] = useState(item.quantity)
  const [busy, setBusy] = useState(false)
  const p = item.product

  const save = async (next) => {
    setQty(next)
    if (next === item.quantity) return
    setBusy(true)
    try {
      setCart((await api.patch(`/cart/items/${item.id}`, { quantity: next })).data)
    } catch (e) {
      toast.error(errorMessage(e))
      setQty(item.quantity)
    } finally {
      setBusy(false)
      onChange?.()
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      setCart((await api.delete(`/cart/items/${item.id}`)).data)
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className={`flex gap-3 py-4 sm:gap-4 ${busy ? 'opacity-60' : ''}`}>
      <Link to={`/products/${p.id}`} className="size-20 shrink-0 overflow-hidden rounded-xl sm:size-24">
        <ProductImage product={p} iconSize="size-8" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${p.id}`} className="line-clamp-2 text-sm font-semibold hover:text-brand-700">{p.name}</Link>
          <button onClick={remove} className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${p.name}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="text-xs text-muted">
          {money(item.unit_price)}/{p.unit}
          {Number(item.savings) > 0 && <span className="ml-1.5 font-semibold text-brand-600">Bulk price · save {money(item.savings)}</span>}
        </div>
        {item.problem && (
          <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="size-3.5" /> {item.problem}</div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <QuantityStepper value={qty} onChange={setQty} min={p.min_order_qty} max={Math.max(p.stock, p.min_order_qty)} unit={p.unit} />
          {qty !== item.quantity && qty >= p.min_order_qty && (
            <Button size="sm" variant="secondary" onClick={() => save(qty)}>Update</Button>
          )}
          <div className="ml-auto font-bold">{money(item.line_total)}</div>
        </div>
      </div>
    </div>
  )
}

function Checkout({ cart }) {
  const { user } = useAuth()
  const { refresh } = useCart()
  const navigate = useNavigate()
  const toast = useToast()
  const { state } = useLocation()
  const formRef = useRef(null)
  // Coming from "Buy now": bring the checkout form into view (it sits below the cart on phones).
  useEffect(() => {
    if (state?.checkout) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [state])
  const [form, setForm] = useState({
    shipping_name: user.full_name, shipping_phone: user.phone || '', shipping_address: '',
    shipping_city: '', shipping_state: '', shipping_pincode: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/orders/checkout', { ...form, notes: form.notes || null, payment_method: 'cod' })
      await refresh()
      toast.success(data.length > 1 ? `${data.length} orders placed — one per seller` : 'Order placed!')
      navigate('/orders', { state: { placed: data.map((o) => o.order_number) } })
    } catch (err) {
      setError(errorMessage(err))
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-bold">Delivery details</h2>
      <ErrorBox message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name"><Input required minLength={2} value={form.shipping_name} onChange={set('shipping_name')} autoComplete="name" /></Field>
        <Field label="Phone"><Input required type="tel" pattern="[0-9+\- ]{7,20}" value={form.shipping_phone} onChange={set('shipping_phone')} autoComplete="tel" /></Field>
      </div>
      <Field label="Address"><Input required minLength={5} value={form.shipping_address} onChange={set('shipping_address')} autoComplete="street-address" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="City"><Input required value={form.shipping_city} onChange={set('shipping_city')} autoComplete="address-level2" /></Field>
        <Field label="State"><Input required value={form.shipping_state} onChange={set('shipping_state')} autoComplete="address-level1" /></Field>
        <Field label="PIN code" className="col-span-2 sm:col-span-1"><Input required inputMode="numeric" pattern="\d{6}" title="6-digit PIN code" value={form.shipping_pincode} onChange={set('shipping_pincode')} autoComplete="postal-code" /></Field>
      </div>
      <Field label="Note for sellers" hint="Optional"><Textarea rows={2} value={form.notes} onChange={set('notes')} /></Field>
      <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3 text-sm">
        <Truck className="size-5 shrink-0 text-brand-700" />
        <div><strong>Cash on delivery.</strong> Pay each seller when your order arrives.</div>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!cart.can_checkout}>
        Place order · {money(cart.total)}
      </Button>
      {!cart.can_checkout && <p className="text-center text-xs text-red-600">Fix the highlighted items in your cart first.</p>}
    </form>
  )
}

export default function Cart() {
  const { user } = useAuth()
  const { cart, refresh } = useCart()

  if (!user) {
    return (
      <div className="container-page py-10"><div className="card"><EmptyState icon={ShoppingCart} title="Log in to see your cart" action={<Button to="/login">Log in</Button>} /></div></div>
    )
  }
  if (!cart) return <Spinner className="min-h-[60vh]" />
  if (!cart.item_count) {
    return (
      <div className="container-page py-10"><div className="card"><EmptyState icon={ShoppingCart} title="Your cart is empty" text="Browse fresh produce and traditional foods from verified sellers." action={<Button to="/shop">Start shopping</Button>} /></div></div>
    )
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Your cart</h1>
      <p className="mb-6 text-sm text-muted">
        {cart.item_count} item{cart.item_count > 1 ? 's' : ''} from {cart.groups.length} seller{cart.groups.length > 1 ? 's' : ''}
        {cart.groups.length > 1 && ' — each seller ships their own order'}
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {cart.groups.map((g) => (
            <div key={g.seller.id} className="card px-4 sm:px-5">
              <div className="flex items-center justify-between border-b border-line py-3">
                <Link to={`/sellers/${g.seller.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-brand-700"><Store className="size-4" /> {g.seller.business_name}</Link>
                <span className="text-sm text-muted">Subtotal <strong className="text-ink">{money(g.subtotal)}</strong></span>
              </div>
              <div className="divide-y divide-line">
                {g.items.map((it) => <CartLine key={`${it.id}-${it.quantity}`} item={it} onChange={refresh} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-2 p-5 text-sm">
            {cart.groups.map((g) => (
              <div key={g.seller.id} className="flex justify-between"><span className="truncate text-muted">{g.seller.business_name}</span><span>{money(g.subtotal)}</span></div>
            ))}
            <div className="flex justify-between text-muted"><span>Delivery</span><span>Arranged by seller</span></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><span>Total</span><span>{money(cart.total)}</span></div>
          </div>
          {user.role === 'buyer' && <Checkout cart={cart} />}
        </div>
      </div>
    </div>
  )
}
