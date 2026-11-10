import { AlertTriangle, ArrowRight, Clock, IndianRupee, Package, Plus, ShoppingBag, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorBox, PageHeader, Spinner, StatCard, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useFetch from '../../hooks/useFetch'
import { date, money } from '../../lib/format'

export function SellerStatusBanner() {
  const { user } = useAuth()
  const { data: profile } = useFetch(user?.seller_status === 'approved' ? null : '/seller/profile')
  if (!user || user.seller_status === 'approved') return null
  if (profile?.status === 'rejected') {
    return (
      <div className="mb-6 flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
        <XCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <strong>Your seller application was not approved.</strong>
          {profile.rejection_reason && <div className="mt-0.5">Reason: {profile.rejection_reason}</div>}
          <div className="mt-1">Update your <Link to="/seller/profile" className="font-semibold underline">business profile</Link> to send it for review again.</div>
        </div>
      </div>
    )
  }
  return (
    <div className="mb-6 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
      <Clock className="mt-0.5 size-5 shrink-0" />
      <div>
        <strong>Your seller account is waiting for approval.</strong>
        <div className="mt-0.5">You can complete your profile and upload certificates now. You’ll be able to add products once an admin approves you.</div>
      </div>
    </div>
  )
}

export default function SellerHome() {
  const { user } = useAuth()
  const { data: stats, loading, error, reload } = useFetch('/seller/stats')
  const { data: orders } = useFetch('/seller/orders')

  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const pendingOrders = stats.orders_by_status.pending || 0

  return (
    <>
      <PageHeader
        title={`Hello, ${user.full_name.split(' ')[0]}`}
        subtitle="Here’s how your shop is doing."
        actions={user.seller_status === 'approved' && <Button to="/seller/products/new"><Plus className="size-4" /> Add product</Button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Revenue (all orders)" value={money(stats.revenue)} icon={IndianRupee} />
        <StatCard label="Orders" value={stats.total_orders} icon={ShoppingBag} tone="sky" to="/seller/orders" />
        <StatCard label="New orders" value={pendingOrders} icon={Clock} tone="amber" to="/seller/orders" />
        <StatCard label="Live products" value={stats.products_by_status.approved || 0} icon={Package} tone="violet" to="/seller/products" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(stats.products_by_status.pending || 0) > 0 && (
          <Link to="/seller/products" className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <Clock className="size-5" /> {stats.products_by_status.pending} product(s) waiting for admin review <ArrowRight className="ml-auto size-4" />
          </Link>
        )}
        {stats.low_stock > 0 && (
          <Link to="/seller/inventory" className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="size-5" /> {stats.low_stock} product(s) running low on stock <ArrowRight className="ml-auto size-4" />
          </Link>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent orders</h2>
          <Link to="/seller/orders" className="text-sm font-semibold text-brand-700">View all</Link>
        </div>
        {!orders ? <Spinner /> : !orders.length ? (
          <div className="card"><EmptyState icon={ShoppingBag} title="No orders yet" text="Orders from buyers will appear here." /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Buyer</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap font-mono text-xs font-semibold"><Link to={`/seller/orders?open=${o.id}`} className="hover:text-brand-700">{o.order_number}</Link></td>
                    <td className="whitespace-nowrap">{o.buyer_name}</td>
                    <td className="whitespace-nowrap text-muted">{date(o.created_at)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right font-semibold">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
