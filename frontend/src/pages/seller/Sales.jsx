import { BarChart3, CheckCircle2, IndianRupee, ShoppingBag } from 'lucide-react'
import { EmptyState, ErrorBox, PageHeader, Spinner, StatCard } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { money } from '../../lib/format'

export default function Sales() {
  const { data, loading, error, reload } = useFetch('/seller/stats')
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const max = Math.max(1, ...data.monthly.map((m) => Number(m.revenue)))
  const avg = data.total_orders ? Number(data.revenue) / (data.total_orders - (data.orders_by_status.cancelled || 0) || 1) : 0

  return (
    <>
      <PageHeader title="Sales overview" subtitle="Cancelled orders are not counted." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={money(data.revenue)} icon={IndianRupee} />
        <StatCard label="Collected (delivered)" value={money(data.delivered_revenue)} icon={CheckCircle2} tone="sky" />
        <StatCard label="Orders" value={data.total_orders} icon={ShoppingBag} tone="amber" />
        <StatCard label="Average order" value={money(avg)} icon={BarChart3} tone="violet" />
      </div>

      {!data.monthly.length ? (
        <div className="card mt-6"><EmptyState icon={BarChart3} title="No sales yet" text="Your monthly sales chart will appear after your first order." /></div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="card p-5 sm:p-6">
            <h2 className="mb-6 font-semibold">Monthly sales</h2>
            <div className="flex h-56 items-end gap-3 sm:gap-6">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-semibold text-ink/80">{money(m.revenue)}</span>
                  <div className="w-full max-w-14 rounded-t-lg bg-brand-700" style={{ height: `${Math.max(4, (Number(m.revenue) / max) * 100)}%` }} title={`${m.orders} orders`} />
                  <span className="text-[11px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Top products</h2>
            <ol className="space-y-3">
              {data.top_products.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted">{p.quantity} units sold</div>
                  </div>
                  <span className="font-semibold">{money(p.revenue)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
