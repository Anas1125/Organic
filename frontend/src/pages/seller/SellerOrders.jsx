import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Modal, PageHeader, Spinner, StatusBadge, Tabs } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'

const NEXT = { pending: 'confirmed', confirmed: 'packed', packed: 'shipped', shipped: 'delivered' }
const NEXT_LABEL = { confirmed: 'Confirm order', packed: 'Mark as packed', shipped: 'Mark as shipped', delivered: 'Mark as delivered' }

export function OrderPanel({ order, onChange, endpoint }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const next = NEXT[order.status]

  const move = async (status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be returned to inventory.')) return
    setBusy(status)
    try {
      onChange((await api.patch(`${endpoint}/${order.id}/status`, { status })).data)
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
      {(next || ['pending', 'confirmed', 'packed'].includes(order.status)) && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {next && <Button loading={busy === next} onClick={() => move(next)}>{NEXT_LABEL[next]}</Button>}
          {['pending', 'confirmed', 'packed'].includes(order.status) && (
            <Button variant="danger-soft" loading={busy === 'cancelled'} onClick={() => move('cancelled')}>Cancel order</Button>
          )}
        </div>
      )}
    </div>
  )
}

export function OrdersTable({ orders, onOpen, showSeller }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Order</th><th>Buyer</th>{showSeller && <th>Seller</th>}<th>Date</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => onOpen(o)} className="cursor-pointer hover:bg-brand-50/50">
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

export default function SellerOrders() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/seller/orders')
  const [openId, setOpenId] = useState(params.get('open') ? Number(params.get('open')) : null)
  const open = data?.find((o) => o.id === openId)
  const count = (s) => data?.filter((o) => o.status === s).length
  const rows = (data || []).filter((o) => !tab || o.status === tab)

  return (
    <>
      <PageHeader title="Orders" subtitle="Confirm, pack and ship orders. Cancelling returns stock to your inventory." />
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
          {rows.length ? <OrdersTable orders={rows} onOpen={(o) => setOpenId(o.id)} /> : <p className="py-8 text-center text-sm text-muted">No orders with this status.</p>}
        </>
      )}
      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} title="Order details" wide>
        {open && <OrderPanel order={open} endpoint="/seller/orders" onChange={(o) => setData(data.map((x) => (x.id === o.id ? o : x)))} />}
      </Modal>
    </>
  )
}
