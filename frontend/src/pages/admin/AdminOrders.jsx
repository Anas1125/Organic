import { Mail, Phone, Search, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { ORDER_STEPS, dateTime, money } from '../../lib/format'
import { OrdersTable } from '../seller/SellerOrders'

function Contact({ title, name, sub, email, phone }) {
  return (
    <div className="rounded-xl bg-canvas p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 font-semibold">{name}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Phone className="size-3.5" />{phone}</a>}
        {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"><Mail className="size-3.5" />{email}</a>}
      </div>
    </div>
  )
}

/** A new order: call the seller, agree stock, price and commission, then approve or decline. */
function EnquiryPanel({ order, onChange }) {
  const toast = useToast()
  const [pct, setPct] = useState('')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const waiting = order.status === 'seller_review'
  useEffect(() => {
    // Start from the rate already offered (or turned down), else the default.
    if (order.approved_at || order.seller_response) return setPct(String(Number(order.commission_rate)))
    api.get('/admin/payouts-commission').then(({ data }) => setPct((p) => p || String(Number(data.commission_percent)))).catch(() => setPct((p) => p || '0'))
  }, [order.approved_at, order.seller_response, order.commission_rate])
  const commission = (Number(order.subtotal) * Number(pct || 0)) / 100

  const act = async (what, call, done) => {
    setBusy(what)
    try {
      onChange((await call()).data)
      toast.success(done)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }
  const approve = () => act('approve', () => api.post(`/admin/orders/${order.id}/approve`, { commission_percent: pct || '0' }),
    waiting ? 'New offer sent to the seller' : 'Sent to the seller to accept')
  const decline = () => act('decline', () => api.post(`/admin/orders/${order.id}/decline`, { reason }), 'Enquiry declined — the buyer has been told')

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
      <div>
        <h3 className="font-semibold">{waiting ? `Waiting for ${order.seller.business_name} to accept ${Number(order.commission_rate)}% commission` : 'New enquiry — waiting for you'}</h3>
        <p className="mt-0.5 text-sm text-ink/70">
          {waiting
            ? `The seller has been emailed the offer and sees it in their Seller hub.${order.answer_by ? ` If they don't answer by ${dateTime(order.answer_by)}, it's cancelled automatically and the buyer is told.` : ''} You can send a new rate, or decline the order for the buyer.`
            : 'Contact the seller to confirm stock and price, and agree your commission. When you approve, the seller is asked to accept that commission; only then is the order confirmed.'}
          {order.payment_method === 'online' ? ' The buyer pays online once the seller accepts.' : ' Cash on delivery: the seller collects the money.'}
        </p>
      </div>
      {order.seller_response && !waiting && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>The seller declined your offer of {Number(order.commission_rate)}%:</strong> {order.seller_response}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Contact title="Seller" name={order.seller.business_name} sub={order.seller_owner} email={order.seller_email} phone={order.seller_phone} />
        <Contact title="Buyer" name={order.buyer_name} sub={[order.buyer_type, `${order.shipping_city}, ${order.shipping_state}`].filter(Boolean).join(' · ')} email={order.buyer_email} phone={order.buyer_phone || order.shipping_phone} />
      </div>
      {!declining ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Agreed commission %" className="w-40">
            <Input type="number" min="0" max="50" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} />
          </Field>
          <div className="pb-2.5 text-sm text-muted">You earn <strong className="text-ink">{money(commission)}</strong> of {money(order.subtotal)}</div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setDeclining(true)} disabled={Boolean(busy)}>Decline</Button>
            <Button onClick={approve} loading={busy === 'approve'} disabled={pct === '' || Number(pct) < 0 || Number(pct) > 50 || (waiting && Number(pct) === Number(order.commission_rate))}>
              {waiting ? 'Send new offer' : 'Approve & send to seller'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Reason (sent to the buyer)">
            <Textarea rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Out of stock until next harvest" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeclining(false)} disabled={Boolean(busy)}>Back</Button>
            <Button variant="danger-soft" onClick={decline} loading={busy === 'decline'} disabled={reason.trim().length < 3}>Decline enquiry</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminOrderPanel({ order, onChange }) {
  const toast = useToast()
  const [status, setStatus] = useState(order.status)
  const [payment, setPayment] = useState(order.payment_status)
  const [busy, setBusy] = useState(false)

  const canRefund = order.payment_method === 'online' && ['paid', 'refund_failed'].includes(order.payment_status)
  const refund = async () => {
    if (!window.confirm(`Refund ${order.total} to the buyer through Razorpay? This can't be undone.`)) return
    setBusy(true)
    try {
      onChange((await api.post(`/admin/orders/${order.id}/refund`)).data)
      toast.success('Refund started')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const markReceived = async () => {
    if (!window.confirm(`Confirm you received ${money(order.total)} for ${order.order_number}? The buyer will be emailed.`)) return
    setBusy(true)
    try {
      onChange((await api.patch(`/admin/orders/${order.id}/status`, { status: order.status, payment_status: 'paid' })).data)
      toast.success('Payment marked as received')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be returned to the seller.')) return
    setBusy(true)
    try {
      onChange((await api.patch(`/admin/orders/${order.id}/status`, { status, payment_status: payment })).data)
      toast.success('Order updated')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (order.status === 'enquiry' || order.status === 'seller_review') {
    return (
      <div className="space-y-5">
        <OrderMeta order={order} />
        <EnquiryPanel order={order} onChange={onChange} />
        <div><h3 className="mb-1 text-sm font-semibold">Items</h3><OrderItemsTable order={order} /></div>
        <div><h3 className="mb-1 text-sm font-semibold">Ship to</h3><ShippingBlock order={order} /></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <OrderMeta order={order} />
      <OrderTimeline status={order.status} reason={order.decline_reason} />
      {order.approved_at && <p className="-mt-2 text-xs text-muted">Commission agreed: {Number(order.commission_rate)}%</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-semibold">Items · {order.seller.business_name}</h3><OrderItemsTable order={order} /></div>
        <div><h3 className="mb-1 text-sm font-semibold">Ship to</h3><ShippingBlock order={order} /><div className="mt-2 text-xs text-muted">Buyer: {order.buyer_name} · {order.buyer_email}</div></div>
      </div>
      {order.payment_method === 'cod' && order.pay_to_marketplace && order.payment_status === 'pending' && ['confirmed', 'packed', 'shipped', 'delivered'].includes(order.status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <span>
            {order.cod_claimed_at
              ? <>The buyer says they paid {money(order.total)} by UPI. Reference <strong className="font-mono">{order.cod_reference}</strong> — check your bank / UPI app.</>
              : <>Pay on delivery: waiting for the buyer to pay {money(order.total)} to your UPI.</>}
          </span>
          <Button size="sm" loading={busy} onClick={markReceived}>Mark payment received</Button>
        </div>
      )}
      {canRefund && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-3 text-sm">
          <span>{order.payment_status === 'refund_failed' ? <>The last refund attempt failed{order.refund_error ? <>: <strong>{order.refund_error}</strong></> : '.'}</> : 'Paid online. For returns or problems you can refund the buyer in full.'}</span>
          <Button size="sm" variant="danger-soft" loading={busy} onClick={refund}>{order.payment_status === 'refund_failed' ? 'Retry refund' : 'Refund buyer'}</Button>
        </div>
      )}
      {!['cancelled', 'awaiting_payment'].includes(order.status) && (
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[...ORDER_STEPS, 'cancelled'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </Field>
          {order.payment_method === 'cod' ? (
            <Field label={order.pay_to_marketplace ? "Payment (on delivery, to you)" : "Payment (cash on delivery)"}>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
              </Select>
            </Field>
          ) : (
            <Field label="Payment"><div className="input flex items-center text-muted">Online · tracked by Razorpay</div></Field>
          )}
          <Button onClick={save} loading={busy} disabled={status === order.status && payment === order.payment_status}>Save</Button>
        </div>
      )}
    </div>
  )
}

export function AdminOrders() {
  // The enquiry email links here with ?status=enquiry&open=<id>.
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('status') || '')
  const [q, setQ] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/admin/orders')
  const [openId, setOpenId] = useState(Number(params.get('open')) || null)
  const open = data?.find((o) => o.id === openId)
  // "Payment due": pay-on-delivery orders whose money hasn't reached the marketplace yet.
  const due = (o) => o.payment_method === 'cod' && o.pay_to_marketplace && o.payment_status === 'pending' && ['confirmed', 'packed', 'shipped', 'delivered'].includes(o.status)
  const inTab = (o, t) => (t === 'payment_due' ? due(o) : o.status === t)
  const count = (s) => data?.filter((o) => inTab(o, s)).length
  const rows = (data || []).filter((o) => (!tab || inTab(o, tab)) && `${o.order_number} ${o.buyer_name} ${o.seller.business_name}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="All orders" subtitle="New orders arrive as enquiries: agree terms with the seller, then approve or decline. Admins can also override any order’s status or payment." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onChange={setTab} options={[{ value: '', label: 'All', count: data?.length }, ...['enquiry', 'seller_review', 'payment_due', 'awaiting_payment', ...ORDER_STEPS, 'cancelled'].map((s) => ({ value: s, label: { enquiry: 'Enquiries', seller_review: 'Awaiting seller', payment_due: 'Payment due', awaiting_payment: 'Unpaid online' }[s] || s[0].toUpperCase() + s.slice(1), count: count(s) }))]} />
        <div className="relative lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Order no., buyer or seller" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={ShoppingBag} title="No orders" /></div>
      ) : <OrdersTable orders={rows} onOpen={(o) => setOpenId(o.id)} showSeller />}
      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} title="Order details" wide>
        {open && <AdminOrderPanel key={open.updated_at} order={open} onChange={(o) => setData(data.map((x) => (x.id === o.id ? o : x)))} />}
      </Modal>
    </>
  )
}

export function AdminMessages() {
  const { data, loading, error, reload } = useFetch('/admin/messages')
  return (
    <>
      <PageHeader title="Contact messages" subtitle="Sent from the Contact us page." />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={Mail} title="No messages yet" /></div>
      ) : (
        <div className="space-y-3">
          {data.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{m.subject}</div>
                <div className="text-xs text-muted">{dateTime(m.created_at)}</div>
              </div>
              <div className="text-sm text-muted">{m.name} · <a href={`mailto:${m.email}`} className="text-brand-700 hover:underline">{m.email}</a></div>
              <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
