import { Boxes, Save } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Button, EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'

function Row({ p, onSaved, canEdit }) {
  const toast = useToast()
  const [stock, setStock] = useState(p.stock)
  const [price, setPrice] = useState(p.price)
  const [busy, setBusy] = useState(false)
  const dirty = Number(stock) !== p.stock || Number(price) !== Number(p.price)
  const low = p.stock < p.min_order_qty * 5

  const save = async () => {
    setBusy(true)
    try {
      onSaved((await api.patch(`/seller/products/${p.id}`, { stock: Number(stock), price: String(price) })).data)
      toast.success(`${p.name} updated`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // One card per product: stacked on phones, a single row on wider screens.
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-5">
      <div className="flex items-start justify-between gap-2 sm:block">
        <div className="min-w-0">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted">Min order {p.min_order_qty} {p.unit}</div>
        </div>
        <div className="shrink-0 sm:hidden"><StatusBadge status={p.status} /></div>
      </div>
      <div className="hidden sm:block"><StatusBadge status={p.status} /></div>
      <div className="grid grid-cols-2 gap-3 sm:contents">
        <label className="block">
          <span className="mb-1 block text-xs text-muted sm:hidden">Price per {p.unit}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">₹</span>
            <input className="input w-full py-1.5 sm:w-24" type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canEdit} aria-label="Price" />
            <span className="hidden text-xs text-muted sm:inline">/{p.unit}</span>
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted sm:hidden">Stock ({p.unit}){low && <span className="ml-1 font-semibold text-red-600">· Low</span>}</span>
          <div className="flex items-center gap-1.5">
            <input className={`input w-full py-1.5 sm:w-24 ${low ? 'border-red-300' : ''}`} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} disabled={!canEdit} aria-label="Stock" />
            {low && <span className="hidden text-xs font-semibold text-red-600 sm:inline">Low</span>}
          </div>
        </label>
      </div>
      <div className="sm:text-right">
        <Button size="sm" className="w-full sm:w-auto" disabled={!dirty} loading={busy} onClick={save}><Save className="size-3.5" /> Save</Button>
      </div>
    </div>
  )
}

export default function Inventory() {
  const { user } = useAuth()
  const { data, setData, loading, error, reload } = useFetch('/seller/products')
  const replace = (np) => setData(data.map((p) => (p.id === np.id ? np : p)))

  return (
    <>
      <PageHeader title="Inventory" subtitle="Quickly update stock and base prices. These changes go live immediately." />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={Boxes} title="Nothing to manage yet" text="Add products first." /></div>
      ) : (
        <div className="space-y-3">
          {data.map((p) => <Row key={`${p.id}-${p.updated_at}`} p={p} onSaved={replace} canEdit={user.seller_status === 'approved'} />)}
        </div>
      )}
    </>
  )
}
