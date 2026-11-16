import { AlertTriangle, Plus, ShieldCheck, ShoppingCart, Smartphone, Store, Trash2, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { AddressFields, AddressOption, EMPTY_ADDRESS, pickAddress } from '../../components/addresses'
import { ProductImage, QuantityStepper } from '../../components/product'
import { Button, EmptyState, ErrorBox, Field, Input, Spinner, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { money } from '../../lib/format'
import { payOnline } from '../../lib/payments'
import useFetch from '../../hooks/useFetch'
import { useSite } from '../../context/SiteContext'

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
  const { data: saved } = useFetch('/addresses')
  // Selected saved address id, or 'new' to type one in.
  const [choice, setChoice] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_ADDRESS, shipping_name: user.full_name, shipping_phone: user.phone || '' })
  const [notes, setNotes] = useState('')
  const [saveNew, setSaveNew] = useState(true)
  useEffect(() => {
    if (saved && choice === null) setChoice(saved.length ? saved.find((a) => a.is_default)?.id ?? saved[0].id : 'new')
  }, [saved, choice])
  const chosen = saved?.find((a) => a.id === choice)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { site } = useSite()
  const { data: payCfg } = useFetch('/payments/config')
  const [method, setMethod] = useState('online')
  const online = payCfg?.online_enabled && method === 'online'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const address = pickAddress(chosen || form)
    delete address.label
    try {
      if (!chosen && saveNew) {
        // Remember it for next time; a failure here shouldn't stop the order.
        await api.post('/addresses', { ...pickAddress(form), is_default: !saved?.length }).catch(() => {})
      }
      const { data } = await api.post('/orders/checkout', { ...address, notes: notes || null, payment_method: online ? 'online' : 'cod' })
      await refresh()
      const numbers = data.map((o) => o.order_number)
      if (!online) {
        toast.success(data.length > 1 ? `${data.length} orders placed — one per seller` : 'Order placed!')
        return navigate('/orders', { state: { placed: numbers } })
      }
      // Orders now wait for payment; stock is held for a short while.
      try {
        const res = await payOnline(data[0].checkout_ref, site.site_name)
        if (res.result === 'paid') {
          toast.success('Payment successful — order placed!')
          return navigate('/orders', { state: { placed: numbers, paid: true } })
        }
        navigate('/orders', { state: { unpaid: data[0].checkout_ref, failed: res.failed } })
      } catch (err) {
        toast.error(err.message || errorMessage(err))
        navigate('/orders', { state: { unpaid: data[0].checkout_ref } })
      }
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
      {saved?.length > 0 && (
        <div className="space-y-2">
          {saved.map((a) => <AddressOption key={a.id} a={a} active={choice === a.id} onClick={() => setChoice(a.id)} />)}
          <button type="button" onClick={() => setChoice('new')} aria-pressed={choice === 'new'} className={`flex w-full items-center gap-2 rounded-xl border-2 border-dashed p-3 text-sm font-semibold transition ${choice === 'new' ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-line text-brand-700 hover:border-brand-300'}`}>
            <Plus className="size-4" /> Deliver to a new address
          </button>
        </div>
      )}
      {choice === 'new' && (
        <>
          <AddressFields value={form} onChange={setForm} />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} className="size-4 rounded accent-brand-700" />
            Save this address for next time
          </label>
        </>
      )}
      <Field label="Note for sellers" hint="Optional"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div>
        <span className="label">Payment</span>
        <div className="space-y-2">
          {payCfg?.online_enabled && (
            <PayOption active={method === 'online'} onClick={() => setMethod('online')} icon={Smartphone} title="UPI, card or netbanking" text="Pay securely now with Razorpay — GPay, PhonePe, Paytm and more" />
          )}
          <PayOption active={!online} onClick={() => setMethod('cod')} icon={Truck} title="Cash on delivery" text="Pay each seller when your order arrives" />
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!cart.can_checkout || choice === null}>
        {online ? `Pay ${money(cart.total)}` : `Place order · ${money(cart.total)}`}
      </Button>
      {online && <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck className="size-3.5" /> Payments are processed by Razorpay. We never see your card or UPI PIN.</p>}
      {!cart.can_checkout && <p className="text-center text-xs text-red-600">Fix the highlighted items in your cart first.</p>}
    </form>
  )
}

function PayOption({ active, onClick, icon: Icon, title, text }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left text-sm transition ${active ? 'border-brand-700 bg-brand-50' : 'border-line bg-white hover:border-brand-300'}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${active ? 'text-brand-700' : 'text-muted'}`} />
      <span><span className="block font-semibold">{title}</span><span className="text-xs text-muted">{text}</span></span>
    </button>
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
