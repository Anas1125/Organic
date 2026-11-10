import { Check, X } from 'lucide-react'
import { ORDER_STEPS, dateTime, money } from '../lib/format'
import { StatusBadge } from './ui'

export function OrderTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        <X className="size-4" /> This order was cancelled
      </div>
    )
  }
  const current = ORDER_STEPS.indexOf(status)
  return (
    <ol className="flex items-start">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-3.5 h-0.5 w-full ${i <= current ? 'bg-brand-700' : 'bg-line'}`} />}
            <span className={`relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold ${done ? 'bg-brand-700 text-white' : 'border-2 border-line bg-white text-muted'}`}>
              {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-2 text-[11px] font-medium capitalize sm:text-xs ${done ? 'text-ink' : 'text-muted'}`}>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function OrderItemsTable({ order }) {
  return (
    <div className="divide-y divide-line">
      {order.items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-4 py-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{it.product_name}</div>
            <div className="text-xs text-muted">{it.quantity} {it.unit} × {money(it.unit_price)}</div>
          </div>
          <div className="font-semibold">{money(it.line_total)}</div>
        </div>
      ))}
      <div className="flex justify-between pt-3 text-sm font-bold"><span>Total</span><span>{money(order.total)}</span></div>
    </div>
  )
}

export function ShippingBlock({ order }) {
  return (
    <div className="text-sm leading-relaxed">
      <div className="font-semibold">{order.shipping_name}</div>
      <div className="text-muted">{order.shipping_address}</div>
      <div className="text-muted">{order.shipping_city}, {order.shipping_state} {order.shipping_pincode}</div>
      <div className="text-muted">{order.shipping_phone}</div>
      {order.notes && <div className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs"><strong>Note:</strong> {order.notes}</div>}
    </div>
  )
}

export function OrderMeta({ order }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="font-mono font-semibold text-ink">{order.order_number}</span>
      <span>·</span>
      <span>{dateTime(order.created_at)}</span>
      <StatusBadge status={order.status} />
      <StatusBadge status={order.payment_status} label={`COD · ${order.payment_status}`} />
    </div>
  )
}
