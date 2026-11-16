import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Package, Store, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { ItemPhoto, OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Spinner, StatusBadge } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'
import { payOnline } from '../../lib/payments'
import { useCart } from '../../context/CartContext'
import { useSite } from '../../context/SiteContext'

/** Pay now / Cancel for a checkout that hasn't been paid yet. */
function useUnpaid(onDone) {
  const toast = useToast()
  const { site } = useSite()
  const { refresh } = useCart()
  const [busy, setBusy] = useState('')
  const pay = async (ref) => {
    setBusy('pay')
    try {
      const res = await payOnline(ref, site.site_name)
      if (res.result === 'paid') toast.success('Payment successful — your order is with the seller')
      else if (res.failed) toast.error(`Payment failed: ${res.failed}`)
      onDone()
    } catch (err) {
      toast.error(err.message || errorMessage(err))
      onDone()
    } finally {
      setBusy('')
    }
  }
  const cancel = async (ref) => {
    if (!window.confirm('Cancel this unpaid order? The items go back in your cart.')) return
    setBusy('cancel')
    try {
      toast.success((await api.post(`/payments/checkout/${ref}/cancel`)).data.detail)
      refresh()
      onDone()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }
  return { pay, cancel, busy }
}

function UnpaidNotice({ orderRef, total, failed, onDone }) {
  const { pay, cancel, busy } = useUnpaid(onDone)
  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-3">
        {failed ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" /> : <Clock className="mt-0.5 size-5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <strong>{failed ? `Payment failed: ${failed}` : 'Payment not completed'}</strong>
          <p className="mt-0.5">Your items are held for a short time{total ? ` (${money(total)})` : ''}. No money was taken if the payment didn't finish. Pay now, or cancel and the items go back in your cart.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === 'pay'} disabled={Boolean(busy)} onClick={() => pay(orderRef)}>Pay now</Button>
            <Button size="sm" variant="outline" loading={busy === 'cancel'} disabled={Boolean(busy)} onClick={() => cancel(orderRef)}>Cancel order</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Orders() {
  const { data, loading, error, reload } = useFetch('/orders')
  const { state } = useLocation()
  const navigate = useNavigate()
  // Any checkout still waiting for payment (from this visit or an earlier one).
  const unpaidRef = data?.find((o) => o.status === 'awaiting_payment')?.checkout_ref
  const unpaidTotal = data?.filter((o) => o.checkout_ref === unpaidRef && o.status === 'awaiting_payment').reduce((n, o) => n + Number(o.total), 0)
  const done = () => { navigate('.', { replace: true, state: null }); reload() }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">My orders</h1>
      {unpaidRef && <UnpaidNotice orderRef={unpaidRef} total={unpaidTotal} failed={state?.unpaid === unpaidRef ? state?.failed : null} onDone={done} />}
      {state?.placed && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-100 p-4 text-sm text-brand-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <strong>{state.paid ? 'Payment successful! ' : 'Thank you! '}Your order{state.placed.length > 1 ? 's were' : ' was'} placed.</strong>
            <div className="mt-0.5 text-brand-800/80">{state.placed.join(', ')} — sellers will confirm shortly.</div>
          </div>
        </div>
      )}
      {error ? <ErrorBox message={error} onRetry={reload} />
        : loading ? <Spinner />
        : !data.length ? <div className="card"><EmptyState icon={Package} title="No orders yet" text="When you place an order it will show up here." action={<Button to="/shop">Start shopping</Button>} /></div>
        : (
          <div className="space-y-3">
            {data.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-lift sm:p-5">
                <OrderThumb order={o} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{o.order_number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted"><Store className="size-3.5" /> {o.seller.business_name} · {o.items.length} item{o.items.length > 1 ? 's' : ''} · {date(o.created_at)}</div>
                </div>
                <div className="text-right font-bold">{money(o.total)}</div>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}

/** First product photo of the order, with a "+N" badge when there are more items. */
function OrderThumb({ order }) {
  const img = order.items.find((it) => it.image)?.image
  return (
    <div className="relative shrink-0">
      <ItemPhoto src={img} alt={order.items[0].product_name} className="size-14 rounded-xl sm:size-16" iconSize="size-5" />
      {order.items.length > 1 && (
        <span className="absolute bottom-1 right-1 rounded-full bg-ink/75 px-1.5 text-[10px] font-semibold text-white">+{order.items.length - 1}</span>
      )}
    </div>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { data: o, setData, loading, error, reload } = useFetch(`/orders/${id}`)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner className="min-h-[60vh]" />
  if (error) return <div className="container-page py-10"><ErrorBox message={error} /></div>

  const received = async () => {
    setBusy(true)
    try {
      setData((await api.post(`/orders/${o.id}/received`)).data)
      toast.success('Thanks! Marked as delivered')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    setBusy(true)
    try {
      setData((await api.post(`/orders/${o.id}/cancel`)).data)
      toast.success('Order cancelled')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <Link to="/orders" className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ChevronLeft className="size-4" /> All orders</Link>
      <h1 className="text-2xl font-bold">Order details</h1>
      <div className="mt-2"><OrderMeta order={o} /></div>

      <div className="mt-6">
        {o.status === 'awaiting_payment' && <UnpaidNotice orderRef={o.checkout_ref} total={Number(o.total)} onDone={reload} />}
      </div>
      <div className="card p-5 sm:p-6"><OrderTimeline status={o.status} /></div>
      {['shipped', 'delivered'].includes(o.status) && (o.courier || o.tracking_number || o.status === 'shipped') && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950">
          <Truck className="size-5 shrink-0 text-violet-700" />
          <div className="min-w-0 flex-1">
            {(o.courier || o.tracking_number)
              ? <div><strong>{o.courier || 'Courier'}</strong>{o.tracking_number && <> · Tracking number <span className="font-mono font-semibold">{o.tracking_number}</span></>}</div>
              : <div><strong>Shipped</strong> — the seller didn't add a tracking number.</div>}
            {o.status === 'shipped' && o.auto_delivery_on && <div className="mt-0.5 text-violet-900/70">If you don't confirm, it will be marked delivered on {date(o.auto_delivery_on)}.</div>}
            {o.status === 'delivered' && o.delivered_at && <div className="mt-0.5 text-violet-900/70">Delivered on {date(o.delivered_at)}.</div>}
          </div>
          {o.status === 'shipped' && <Button size="sm" loading={busy} onClick={received}>I've received it</Button>}
        </div>
      )}
      {['refund_pending', 'refunded', 'refund_failed'].includes(o.payment_status) && (
        <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
          {o.payment_status === 'refunded' && <><strong>Refunded.</strong> {money(o.total)} was returned to your original payment method.</>}
          {o.payment_status === 'refund_pending' && <><strong>Refund in progress.</strong> {money(o.total)} usually reaches your account in 5–7 working days.</>}
          {o.payment_status === 'refund_failed' && <><strong>Refund delayed.</strong> Our team has been alerted and will complete your refund of {money(o.total)}.</>}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="card p-5 sm:p-6">
          <Link to={`/sellers/${o.seller.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold hover:text-brand-700"><Store className="size-4" /> {o.seller.business_name}</Link>
          <OrderItemsTable order={o} />
        </div>
        <div className="card p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold">Delivering to</h2>
          <ShippingBlock order={o} />
          {['pending', 'confirmed'].includes(o.status) && (
            <Button variant="danger-soft" className="mt-5 w-full" loading={busy} onClick={cancel}>Cancel order</Button>
          )}
        </div>
      </div>
    </div>
  )
}
