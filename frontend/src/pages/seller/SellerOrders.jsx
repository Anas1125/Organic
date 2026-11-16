import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Spinner, StatusBadge, Tabs } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'

const NEXT = { pending: 'confirmed', confirmed: 'packed', packed: 'shipped', shipped: 'delivered' }
const NEXT_LABEL = { confirmed: 'Confirm order', packed: 'Mark as packed', shipped: 'Mark as shipped', delivered: 'Mark as delivered' }

export function OrderPanel({ order, onChange, endpoint }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [ship, setShip] = useState({ courier: '', tracking_number: '' })
  const next = NEXT[order.status]

  const move = async (status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be returned to inventory.')) return
    setBusy(status)
    try {
      const extra = status === 'shipped' ? { courier: ship.courier || null, tracking_number: ship.tracking_number || null } : {}
      onChange((await api.patch(`${endpoint}/${order.id}/status`, { status, ...extra })).data)
      toast.success(`Order ${status}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-5">
      <OrderMeta order={order} />
      <OrderTimeline status={order.status} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Items</h3>
          <OrderItemsTable order={order} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Ship to</h3>
          <ShippingBlock order={order} />
          <div className="mt-2 text-xs text-muted">Buyer: {order.buyer_name} · {order.buyer_email}</div>
        </div>
      </div>
      {(order.courier || order.tracking_number) && (
        <div className="rounded-xl bg-canvas p-3 text-sm"><strong>Shipped with</strong> {order.courier || '—'} · Tracking <span className="font-mono">{order.tracking_number || '—'}</span></div>
      )}
      {next === 'shipped' && (
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Courier" hint="Optional, e.g. India Post, DTDC, Delhivery"><Input maxLength={60} value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} /></Field>
          <Field label="Tracking number" hint="Optional — shown to the buyer"><Input maxLength={80} value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} /></Field>
        </div>
      )}
      {(next || ['pending', 'confirmed', 'packed'].includes(order.status)) && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {next && next !== 'delivered' && <Button loading={busy === next} onClick={() => move(next)}>{NEXT_LABEL[next]}</Button>}
          {next === 'delivered' && <p className="self-center text-sm text-muted">Marked delivered when the buyer confirms, or automatically{order.auto_delivery_on ? ` on ${date(order.auto_delivery_on)}` : ''}. <button type="button" className="font-semibold text-brand-700 underline" onClick={() => move('delivered')}>Mark delivered now</button></p>}
          {['pending', 'confirmed', 'packed'].includes(order.status) && (
            <Button variant="danger-soft" loading={busy === 'cancelled'} onClick={() => move('cancelled')}>Cancel order</Button>
          )}
        </div>
      )}
    </div>
  )
}

export function OrdersTable({ orders, onOpen, showSeller, selected, onSelect }) {
  const selectable = Boolean(onSelect)
  const allOn = selectable && orders.length > 0 && orders.every((o) => selected.has(o.id))
  const toggleAll = () => onSelect(allOn ? new Set() : new Set(orders.map((o) => o.id)))
  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); onSelect(n) }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {selectable && <th className="w-10"><input type="checkbox" checked={allOn} onChange={toggleAll} className="size-4 accent-brand-700" aria-label="Select all orders" /></th>}
            <th>Order</th><th>Buyer</th>{showSeller && <th>Seller</th>}<th>Date</th><th>Items</th><th>Status</th><th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => onOpen(o)} className={`cursor-pointer hover:bg-brand-50/50 ${selectable && selected.has(o.id) ? 'bg-brand-50' : ''}`}>
              {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="size-4 accent-brand-700" aria-label={`Select ${o.order_number}`} /></td>}
              <td className="whitespace-nowrap font-mono text-xs font-semibold">{o.order_number}</td>
              <td className="whitespace-nowrap">{o.buyer_name}</td>
              {showSeller && <td className="whitespace-nowrap">{o.seller.business_name}</td>}
              <td className="whitespace-nowrap text-muted">{date(o.created_at)}</td>
              <td>{o.items.length}</td>
              <td><StatusBadge status={o.status} /></td>
              <td className="text-right font-semibold">{money(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Mark many orders shipped at once, with one courier and a tracking number per order. */
function BulkShipDialog({ open, orders, onClose, onDone }) {
  const toast = useToast()
  const [courier, setCourier] = useState('')
  const [tracking, setTracking] = useState({})
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/seller/orders/bulk-status', { order_ids: orders.map((o) => o.id), status: 'shipped', courier: courier || null, tracking })
      toast.success(`${data.updated.length} order${data.updated.length === 1 ? '' : 's'} marked shipped — buyers have been emailed`)
      if (data.failed.length) toast.error(`${data.failed.length} couldn't be updated: ${data.failed[0].reason}`)
      onDone(data.updated)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Mark ${orders.length} order${orders.length === 1 ? '' : 's'} shipped`} wide
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Mark shipped</Button></>}>
      <div className="space-y-4 text-sm">
        <Field label="Courier" hint="Optional — used for all these orders"><Input maxLength={60} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. India Post, DTDC, Delhivery" /></Field>
        <div>
          <span className="label">Tracking numbers (optional)</span>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 font-mono text-xs font-semibold">{o.order_number}</span>
                <Input maxLength={80} value={tracking[o.id] || ''} onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })} aria-label={`Tracking number for ${o.order_number}`} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Buyers get an email with the tracking details. Orders are marked delivered when the buyer confirms, or automatically after a few days.</p>
      </div>
    </Modal>
  )
}

export default function SellerOrders() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/seller/orders')
  const [openId, setOpenId] = useState(params.get('open') ? Number(params.get('open')) : null)
  const open = data?.find((o) => o.id === openId)
  const count = (s) => data?.filter((o) => o.status === s).length
  const rows = (data || []).filter((o) => !tab || o.status === tab)
  const [selected, setSelected] = useState(new Set())
  const [shipOpen, setShipOpen] = useState(false)
  const picked = rows.filter((o) => selected.has(o.id))
  const same = picked.length && picked.every((o) => o.status === picked[0].status) ? picked[0].status : null
  const bulkNext = same && same !== 'shipped' ? NEXT[same] : null
  const replace = (updated) => setData(data.map((x) => updated.find((u) => u.id === x.id) || x))
  const toast = useToast()
  const bulkMove = async (status) => {
    try {
      const { data: r } = await api.post('/seller/orders/bulk-status', { order_ids: picked.map((o) => o.id), status })
      replace(r.updated)
      setSelected(new Set())
      toast.success(`${r.updated.length} order${r.updated.length === 1 ? '' : 's'} updated`)
      if (r.failed.length) toast.error(`${r.failed.length} couldn't be updated: ${r.failed[0].reason}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Orders" subtitle="New orders are confirmed automatically. Tick several to pack or ship them together; shipped orders are marked delivered by themselves." />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={ShoppingBag} title="No orders yet" text="When buyers order your products, they appear here." /></div>
      ) : (
        <>
          <div className="mb-4">
            <Tabs value={tab} onChange={setTab} options={[
              { value: '', label: 'All', count: data.length },
              ...['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: count(s) })),
            ]} />
          </div>
          {picked.length > 0 && (
            <div className="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-sm text-white shadow-lift">
              <strong>{picked.length} selected</strong>
              {bulkNext
                ? <Button size="sm" variant="secondary" onClick={() => (bulkNext === 'shipped' ? setShipOpen(true) : bulkMove(bulkNext))}>{NEXT_LABEL[bulkNext]} ({picked.length})</Button>
                : <span className="text-white/70">{same === 'shipped' ? 'Shipped orders are delivered automatically.' : 'Pick orders with the same status to update them together.'}</span>}
              <button type="button" className="ml-auto text-white/80 underline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          {rows.length ? <OrdersTable orders={rows} onOpen={(o) => setOpenId(o.id)} selected={selected} onSelect={setSelected} /> : <p className="py-8 text-center text-sm text-muted">No orders with this status.</p>}
        </>
      )}
      <BulkShipDialog open={shipOpen} orders={picked} onClose={() => setShipOpen(false)} onDone={(updated) => { replace(updated); setSelected(new Set()); setShipOpen(false) }} />
      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} title="Order details" wide>
        {open && <OrderPanel order={open} endpoint="/seller/orders" onChange={(o) => setData(data.map((x) => (x.id === o.id ? o : x)))} />}
      </Modal>
    </>
  )
}
