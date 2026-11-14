import { BadgeCheck, Clapperboard, FolderTree, Leaf, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import MediaEditor from '../../components/MediaEditor'
import { ProductImage } from '../../components/product'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Spinner, StatusBadge, Tabs, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { money } from '../../lib/format'
import ReviewDialog from './ReviewDialog'

export function AdminProducts() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/admin/products')
  const [rejecting, setRejecting] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [media, setMedia] = useState(null)
  const updated = (p) => {
    setData(data.map((x) => (x.id === p.id ? p : x)))
    setMedia(p)
  }

  const review = async (p, status, reason) => {
    try {
      const { data: updated } = await api.patch(`/admin/products/${p.id}/status`, { status, reason })
      setData(data.map((x) => (x.id === p.id ? updated : x)))
      toast.success(`${p.name} ${status}`)
      setRejecting(null)
      setViewing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const count = (s) => data?.filter((x) => x.status === s).length
  const rows = (data || []).filter((p) => (!tab || p.status === tab) && p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="Products" subtitle="Approve listings before buyers can see them." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} options={[
          { value: 'pending', label: 'Pending', count: count('pending') },
          { value: 'approved', label: 'Approved', count: count('approved') },
          { value: 'rejected', label: 'Rejected', count: count('rejected') },
          { value: '', label: 'All', count: data?.length },
        ]} />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={Package} title="No products here" /></div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <button onClick={() => setViewing(p)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl"><ProductImage product={p} iconSize="size-7" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.name}</span><StatusBadge status={p.status} /></div>
                  <div className="truncate text-sm text-muted">{p.seller.business_name} · {p.category.name} · {money(p.price)}/{p.unit}</div>
                  <div className="mt-0.5 flex gap-3 text-xs">
                    {p.organic_certification_id && <span className={p.is_organic_verified ? 'text-brand-700' : 'text-amber-700'}><Leaf className="mr-0.5 inline size-3" />Organic {p.is_organic_verified ? 'verified' : 'unverified'}</span>}
                    {p.gi_record_id && <span className={p.is_gi_verified ? 'text-brand-700' : 'text-amber-700'}><BadgeCheck className="mr-0.5 inline size-3" />GI {p.is_gi_verified ? 'verified' : 'unverified'}</span>}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setMedia(p)}><Clapperboard className="size-4" /> Edit media</Button>
                {p.status !== 'approved' && <Button size="sm" onClick={() => review(p, 'approved')}>Approve</Button>}
                {p.status !== 'rejected' && <Button size="sm" variant="danger-soft" onClick={() => setRejecting(p)}>Reject</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.name} wide
        footer={viewing && <>
          {viewing.status !== 'rejected' && <Button variant="danger-soft" onClick={() => setRejecting(viewing)}>Reject</Button>}
          {viewing.status !== 'approved' && <Button onClick={() => review(viewing, 'approved')}>Approve</Button>}
        </>}>
        {viewing && (
          <div className="space-y-4 text-sm">
            {viewing.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">{viewing.images.map((im) => <img key={im.id} src={im.url} alt="" className="size-28 shrink-0 rounded-xl object-cover" />)}</div>
            )}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[['Seller', viewing.seller.business_name], ['Category', viewing.category.name], ['Origin', viewing.origin || '—'],
                ['Price', `${money(viewing.price)}/${viewing.unit}`], ['Stock', `${viewing.stock} ${viewing.unit}`], ['Min order', `${viewing.min_order_qty} ${viewing.unit}`]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {viewing.price_tiers.length > 0 && (
              <div><div className="mb-1 text-xs text-muted">Bulk tiers</div>{viewing.price_tiers.map((t) => <div key={t.id}>{t.min_qty}{t.max_qty ? `–${t.max_qty}` : '+'} {viewing.unit}: {money(t.unit_price)}</div>)}</div>
            )}
            <div><div className="mb-1 text-xs text-muted">Description</div><p className="whitespace-pre-line">{viewing.description || '—'}</p></div>
            {(viewing.organic_certification_id || viewing.gi_record_id) && (
              <p className="rounded-xl bg-canvas p-3 text-xs">
                Linked certificates must be verified separately on the <Link to="/admin/organic" className="font-semibold text-brand-700">Organic</Link> and <Link to="/admin/gi" className="font-semibold text-brand-700">GI</Link> pages before badges appear.
              </p>
            )}
          </div>
        )}
      </Modal>
      <Modal open={Boolean(media)} onClose={() => setMedia(null)} title={media ? `Media · ${media.name}` : ''} wide
        footer={<Button onClick={() => setMedia(null)}>Done</Button>}>
        {media && <MediaEditor product={media} base={`/admin/products/${media.id}`} onChange={updated} />}
      </Modal>
      <ReviewDialog open={Boolean(rejecting)} title={`Reject ${rejecting?.name || ''}`} onClose={() => setRejecting(null)} onSubmit={(reason) => review(rejecting, 'rejected', reason)} />
    </>
  )
}

export function AdminCategories() {
  const toast = useToast()
  const { data, setData, loading, error, reload } = useFetch('/admin/categories')
  const [editing, setEditing] = useState(null) // {} for new
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    const body = { name: editing.name, description: editing.description || null, is_active: editing.is_active }
    try {
      if (editing.id) {
        const { data: c } = await api.patch(`/admin/categories/${editing.id}`, body)
        setData(data.map((x) => (x.id === c.id ? { ...c, product_count: x.product_count } : x)))
      } else {
        const { data: c } = await api.post('/admin/categories', body)
        setData([...data, c].sort((a, b) => a.name.localeCompare(b.name)))
      }
      toast.success('Category saved')
      setEditing(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c) => {
    if (!window.confirm(`Delete “${c.name}”?`)) return
    try {
      await api.delete(`/admin/categories/${c.id}`)
      setData(data.filter((x) => x.id !== c.id))
      toast.success('Category deleted')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Categories" actions={<Button onClick={() => setEditing({ name: '', description: '', is_active: true })}><Plus className="size-4" /> Add category</Button>} />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={FolderTree} title="No categories" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Products</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><div className="font-medium">{c.name}</div>{c.description && <div className="max-w-md truncate text-xs text-muted">{c.description}</div>}</td>
                  <td>{c.product_count}</td>
                  <td><StatusBadge status={c.is_active ? 'active' : 'inactive'} label={c.is_active ? 'Visible' : 'Hidden'} /></td>
                  <td className="whitespace-nowrap text-right">
                    <button onClick={() => setEditing(c)} className="rounded-full p-2 hover:bg-brand-50" aria-label="Edit"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(c)} className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'New category'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name"><Input required minLength={2} maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea rows={2} maxLength={500} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-700" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Visible in marketplace</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
          </form>
        )}
      </Modal>
    </>
  )
}
