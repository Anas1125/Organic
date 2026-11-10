import { BadgeCheck, IndianRupee, Leaf, Package, ShoppingBag, Store, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorBox, PageHeader, Spinner, StatCard, StatusBadge } from '../../components/ui'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'

export default function AdminHome() {
  const { data: s, loading, error, reload } = useFetch('/admin/stats')
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const queue = [
    { n: s.pending_sellers, label: 'sellers waiting for approval', to: '/admin/sellers', icon: Store },
    { n: s.pending_products, label: 'products waiting for review', to: '/admin/products', icon: Package },
    { n: s.pending_certifications, label: 'organic certificates to verify', to: '/admin/organic', icon: Leaf },
    { n: s.pending_gi, label: 'GI records to verify', to: '/admin/gi', icon: BadgeCheck },
  ].filter((q) => q.n > 0)

  return (
    <>
      <PageHeader title="Platform overview" subtitle="Everything that needs your attention, at a glance." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Order value (excl. cancelled)" value={money(s.gmv)} icon={IndianRupee} />
        <StatCard label="Orders" value={s.orders} icon={ShoppingBag} tone="sky" to="/admin/orders" />
        <StatCard label="Sellers" value={s.sellers} icon={Store} tone="amber" to="/admin/sellers" />
        <StatCard label="Buyers" value={s.buyers} icon={Users} tone="violet" to="/admin/users" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Live products" value={`${s.live_products} / ${s.products}`} icon={Package} />
        <StatCard label="Open orders" value={s.open_orders} icon={ShoppingBag} tone="sky" to="/admin/orders" />
        <StatCard label="Contact messages" value={s.messages} icon={Users} tone="violet" to="/admin/messages" />
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Review queue</h2>
      {queue.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {queue.map(({ n, label, to, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100">
              <Icon className="size-5" /><strong className="text-lg">{n}</strong> {label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="card p-5 text-sm text-muted">All caught up — nothing waiting for review.</p>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Latest orders</h2>
      {s.recent_orders.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Buyer</th><th>Seller</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {s.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-semibold">{o.order_number}</td>
                  <td className="whitespace-nowrap">{o.buyer_name}</td>
                  <td className="whitespace-nowrap">{o.seller.business_name}</td>
                  <td className="whitespace-nowrap text-muted">{date(o.created_at)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right font-semibold">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="card p-5 text-sm text-muted">No orders yet.</p>}
    </>
  )
}
