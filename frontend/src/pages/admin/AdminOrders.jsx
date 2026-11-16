import { Mail, Search, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Field, Modal, PageHeader, Select, Spinner, Tabs } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { ORDER_STEPS, dateTime } from '../../lib/format'
import { OrdersTable } from '../seller/SellerOrders'

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

  return (
    <div className="space-y-5">
      <OrderMeta order={order} />
      <OrderTimeline status={order.status} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-semibold">Items · {order.seller.business_name}</h3><OrderItemsTable order={order} /></div>
        <div><h3 className="mb-1 text-sm font-semibold">Ship to</h3><ShippingBlock order={order} /><div className="mt-2 text-xs text-muted">Buyer: {order.buyer_name} · {order.buyer_email}</div></div>
      </div>
      {canRefund && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-3 text-sm">
          <span>{order.payment_status === 'refund_failed' ? 'The refund failed at Razorpay. Try again:' : 'Paid online. For returns or problems you can refund the buyer in full.'}</span>
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
            <Field label="Payment (cash on delivery)">
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
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/admin/orders')
  const [openId, setOpenId] = useState(null)
  const open = data?.find((o) => o.id === openId)
  const count = (s) => data?.filter((o) => o.status === s).length
  const rows = (data || []).filter((o) => (!tab || o.status === tab) && `${o.order_number} ${o.buyer_name} ${o.seller.business_name}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="All orders" subtitle="Admins can override any order’s status or payment." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onChange={setTab} options={[{ value: '', label: 'All', count: data?.length }, ...['awaiting_payment', ...ORDER_STEPS, 'cancelled'].map((s) => ({ value: s, label: s === 'awaiting_payment' ? 'Unpaid' : s[0].toUpperCase() + s.slice(1), count: count(s) }))]} />
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
