import { CheckCircle2, ChevronLeft, ChevronRight, Package, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { OrderItemsTable, OrderMeta, OrderTimeline, ShippingBlock } from '../../components/orders'
import { Button, EmptyState, ErrorBox, Spinner, StatusBadge } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'

export function Orders() {
  const { data, loading, error, reload } = useFetch('/orders')
  const { state } = useLocation()

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">My orders</h1>
      {state?.placed && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-brand-100 p-4 text-sm text-brand-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <strong>Thank you! Your order{state.placed.length > 1 ? 's were' : ' was'} placed.</strong>
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
                <div className="hidden size-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 sm:grid"><Package className="size-5" /></div>
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

export function OrderDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { data: o, setData, loading, error } = useFetch(`/orders/${id}`)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner className="min-h-[60vh]" />
  if (error) return <div className="container-page py-10"><ErrorBox message={error} /></div>

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

      <div className="card mt-6 p-5 sm:p-6"><OrderTimeline status={o.status} /></div>

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
