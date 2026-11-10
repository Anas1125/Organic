import { BadgeCheck, Leaf, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { ProductImage } from '../../components/product'
import { Button, EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge, Tabs } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { money } from '../../lib/format'

export default function SellerProducts() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/seller/products')
  const approved = user.seller_status === 'approved'

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return
    try {
      await api.delete(`/seller/products/${p.id}`)
      setData(data.filter((x) => x.id !== p.id))
      toast.success('Product deleted')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const count = (s) => data?.filter((p) => p.status === s).length
  const rows = (data || []).filter((p) => (!tab || p.status === tab) && p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="My products" subtitle="New products and major edits are reviewed by an admin before going live." actions={approved && <Button to="/seller/products/new"><Plus className="size-4" /> Add product</Button>} />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={Package} title="No products yet" text={approved ? 'Add your first product to start selling.' : 'You can add products once your account is approved.'} action={approved && <Button to="/seller/products/new">Add product</Button>} /></div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onChange={setTab} options={[
              { value: '', label: 'All', count: data.length },
              { value: 'approved', label: 'Live', count: count('approved') },
              { value: 'pending', label: 'In review', count: count('pending') },
              { value: 'rejected', label: 'Rejected', count: count('rejected') },
            ]} />
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            {rows.map((p) => (
              <div key={p.id} className="card flex gap-4 p-3 sm:items-center sm:p-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl sm:size-20"><ProductImage product={p} iconSize="size-7" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <StatusBadge status={p.status} label={p.status === 'approved' ? 'Live' : p.status === 'pending' ? 'In review' : 'Rejected'} />
                    {!p.is_active && <StatusBadge status="inactive" label="Hidden" />}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {money(p.price)}/{p.unit} · {p.stock} {p.unit} in stock · {p.category.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {p.organic_certification_id && (
                      <span className={`flex items-center gap-1 ${p.is_organic_verified ? 'text-brand-700' : 'text-amber-700'}`}><Leaf className="size-3" />{p.is_organic_verified ? 'Organic verified' : 'Organic cert pending'}</span>
                    )}
                    {p.gi_record_id && (
                      <span className={`flex items-center gap-1 ${p.is_gi_verified ? 'text-brand-700' : 'text-amber-700'}`}><BadgeCheck className="size-3" />{p.is_gi_verified ? 'GI verified' : 'GI pending'}</span>
                    )}
                  </div>
                  {p.rejection_reason && <div className="mt-1 text-xs text-red-600">Reason: {p.rejection_reason}</div>}
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  {approved && <Link to={`/seller/products/${p.id}/edit`} className="grid size-9 place-items-center rounded-full hover:bg-brand-50" aria-label="Edit"><Pencil className="size-4" /></Link>}
                  <button onClick={() => remove(p)} className="grid size-9 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
            {!rows.length && <p className="py-8 text-center text-sm text-muted">No products match.</p>}
          </div>
        </>
      )}
    </>
  )
}
