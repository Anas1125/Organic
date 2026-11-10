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

  return (
    <tr>
      <td>
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-muted">Min order {p.min_order_qty} {p.unit}</div>
      </td>
      <td><StatusBadge status={p.status} /></td>
      <td>
        <div className="flex items-center gap-1.5">
          <span className="text-muted">₹</span>
          <input className="input w-24 py-1.5" type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canEdit} aria-label="Price" />
          <span className="text-xs text-muted">/{p.unit}</span>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <input className={`input w-24 py-1.5 ${low ? 'border-red-300' : ''}`} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} disabled={!canEdit} aria-label="Stock" />
          {low && <span className="text-xs font-semibold text-red-600">Low</span>}
        </div>
      </td>
      <td className="text-right">
        <Button size="sm" disabled={!dirty} loading={busy} onClick={save}><Save className="size-3.5" /> Save</Button>
      </td>
    </tr>
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
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Status</th><th>Base price</th><th>Stock</th><th></th></tr></thead>
            <tbody>{data.map((p) => <Row key={`${p.id}-${p.updated_at}`} p={p} onSaved={replace} canEdit={user.seller_status === 'approved'} />)}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
