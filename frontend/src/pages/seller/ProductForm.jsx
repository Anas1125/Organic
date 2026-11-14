import { ChevronLeft, ImagePlus, Info, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { Button, ErrorBox, Field, Input, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import MediaEditor from '../../components/MediaEditor'
import useFetch from '../../hooks/useFetch'
import { UNITS, money } from '../../lib/format'

const EMPTY = {
  name: '', description: '', category_id: '', price: '', unit: 'kg', stock: '', min_order_qty: 1,
  origin: '', is_active: true, organic_certification_id: '', gi_record_id: '', price_tiers: [],
  key_points: '',
}

function TierEditor({ tiers, onChange, unit, basePrice }) {
  const update = (i, k, v) => onChange(tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)))
  const add = () => {
    const last = tiers[tiers.length - 1]
    const start = last ? (Number(last.max_qty) || Number(last.min_qty)) + 1 : 1
    onChange([...tiers, { min_qty: start, max_qty: '', unit_price: '' }])
  }
  return (
    <div className="space-y-3">
      {tiers.length === 0 && <p className="text-sm text-muted">No bulk pricing. Every quantity is sold at {basePrice ? money(basePrice) : 'the base price'}/{unit}.</p>}
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-2">
          <Field label={i === 0 ? `From (${unit})` : undefined}><Input type="number" min="1" required value={t.min_qty} onChange={(e) => update(i, 'min_qty', e.target.value)} /></Field>
          <Field label={i === 0 ? `To (${unit})` : undefined}><Input type="number" min="1" placeholder="and above" value={t.max_qty ?? ''} onChange={(e) => update(i, 'max_qty', e.target.value)} /></Field>
          <Field label={i === 0 ? `Price per ${unit} (₹)` : undefined}><Input type="number" min="0.01" step="0.01" required value={t.unit_price} onChange={(e) => update(i, 'unit_price', e.target.value)} /></Field>
          <button type="button" onClick={() => onChange(tiers.filter((_, j) => j !== i))} className="mb-1 grid size-9 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label="Remove tier"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={add}><Plus className="size-4" /> Add price tier</Button>
      <p className="flex items-start gap-1.5 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" /> Example: 1–5 kg at ₹100, 6–25 kg at ₹90, 26+ kg at ₹80. Ranges must not overlap. Quantities outside every range use the base price.</p>
    </div>
  )
}

function ImageManager({ product, pending, setPending, onProductChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const existing = product?.images || []

  const pick = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    if (!product) return setPending([...pending, ...files].slice(0, 6))
    setBusy(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      onProductChange((await api.post(`/seller/products/${product.id}/images`, fd)).data)
      toast.success('Images uploaded')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const removeExisting = async (img) => {
    try {
      onProductChange((await api.delete(`/seller/products/${product.id}/images/${img.id}`)).data)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {existing.map((img) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-canvas">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => removeExisting(img)} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-red-600 shadow" aria-label="Remove image"><X className="size-4" /></button>
          </div>
        ))}
        {pending.map((f, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-canvas">
            <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-red-600 shadow" aria-label="Remove image"><X className="size-4" /></button>
          </div>
        ))}
        {existing.length + pending.length < 6 && (
          <label className={`grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand-700 hover:bg-brand-50 ${busy ? 'opacity-50' : ''}`}>
            <div className="text-center text-xs font-medium"><ImagePlus className="mx-auto mb-1 size-6" />{busy ? 'Uploading…' : 'Add photos'}</div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={pick} disabled={busy} />
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Up to 6 photos. JPG, PNG or WebP, max 5 MB each. The first photo is the cover.</p>
    </div>
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { data: categories } = useFetch('/categories')
  const { data: certs } = useFetch('/seller/certifications')
  const { data: gis } = useFetch('/seller/gi-records')
  const { data: existing, setData: setExisting, loading } = useFetch(editing ? `/seller/products/${id}` : null)
  const [form, setForm] = useState(EMPTY)
  const [pendingImages, setPendingImages] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!existing) return
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, existing[k] ?? EMPTY[k]])),
      key_points: '',
      category_id: existing.category.id,
      price_tiers: existing.price_tiers.map(({ min_qty, max_qty, unit_price }) => ({ min_qty, max_qty: max_qty ?? '', unit_price })),
    })
  }, [existing])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      ...form,
      category_id: Number(form.category_id),
      stock: Number(form.stock),
      min_order_qty: Number(form.min_order_qty),
      origin: form.origin || null,
      organic_certification_id: form.organic_certification_id ? Number(form.organic_certification_id) : null,
      gi_record_id: form.gi_record_id ? Number(form.gi_record_id) : null,
      price_tiers: form.price_tiers.map((t) => ({ min_qty: Number(t.min_qty), max_qty: t.max_qty === '' ? null : Number(t.max_qty), unit_price: t.unit_price })),
      key_points: form.key_points.split('\n').map((l) => l.trim()).filter(Boolean),
    }
    // When editing, key points are saved from the Media section instead.
    if (editing) delete body.key_points
    try {
      if (editing) {
        const { data } = await api.patch(`/seller/products/${id}`, body)
        setExisting(data)
        toast.success(data.status === 'pending' ? 'Saved — sent to admin for review' : 'Product saved')
        navigate('/seller/products')
      } else {
        const { data } = await api.post('/seller/products', body)
        if (pendingImages.length) {
          const fd = new FormData()
          pendingImages.forEach((f) => fd.append('files', f))
          try { await api.post(`/seller/products/${data.id}/images`, fd) } catch (err) { toast.error(`Product saved, but images failed: ${errorMessage(err)}`) }
        }
        toast.success('Product submitted for review')
        navigate('/seller/products')
      }
    } catch (err) {
      setError(errorMessage(err))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  if (editing && loading) return <Spinner />

  return (
    <>
      <Link to="/seller/products" className="mb-3 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ChevronLeft className="size-4" /> My products</Link>
      <PageHeader
        title={editing ? 'Edit product' : 'Add product'}
        subtitle={editing ? 'Changing the name, description, category, unit, origin or certificates sends it back for review. Price and stock changes go live right away.' : 'Your product will go live after an admin reviews it.'}
        actions={existing && <StatusBadge status={existing.status} />}
      />
      <form onSubmit={submit} className="space-y-5">
        <ErrorBox message={error} />

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Basic details</h2>
          <Field label="Product name"><Input required minLength={2} maxLength={150} value={form.name} onChange={set('name')} placeholder="e.g. Mappillai Samba Rice" /></Field>
          <Field label="Description"><Textarea rows={4} maxLength={5000} value={form.description} onChange={set('description')} placeholder="How it is grown or made, taste, how to use it…" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select required value={form.category_id} onChange={set('category_id')}>
                <option value="">Choose a category</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Origin / location" hint="Village, district or state"><Input maxLength={150} value={form.origin || ''} onChange={set('origin')} placeholder="e.g. Thanjavur, Tamil Nadu" /></Field>
          </div>
        </section>

        {editing && existing ? (
          <section className="card space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">Video, photos & key points</h2>
              <p className="text-sm text-muted">These save straight away and don't need admin review.</p>
            </div>
            <MediaEditor product={existing} base={`/seller/products/${existing.id}`} onChange={setExisting} />
          </section>
        ) : (
          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-semibold">Photos & key points</h2>
            <ImageManager product={null} pending={pendingImages} setPending={setPendingImages} onProductChange={setExisting} />
            <Field label="Key points" hint="One per line, up to 8. You can add a video after saving.">
              <Textarea rows={4} value={form.key_points} onChange={set('key_points')} placeholder={'Pure mulberry silk with real zari\nWoven on a pit loom in 10 days'} />
            </Field>
          </section>
        )}

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Price & stock</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Base price (₹)"><Input type="number" required min="0.01" step="0.01" value={form.price} onChange={set('price')} /></Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
            </Field>
            <Field label="Stock available"><Input type="number" required min="0" value={form.stock} onChange={set('stock')} /></Field>
            <Field label="Minimum order"><Input type="number" required min="1" value={form.min_order_qty} onChange={set('min_order_qty')} /></Field>
          </div>
          <div className="border-t border-line pt-4">
            <h3 className="mb-3 text-sm font-semibold">Bulk pricing (optional)</h3>
            <TierEditor tiers={form.price_tiers} onChange={(price_tiers) => setForm({ ...form, price_tiers })} unit={form.unit} basePrice={form.price} />
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Certifications</h2>
          <p className="text-sm text-muted">Link a certificate you’ve uploaded. Badges only show to buyers once an admin has verified the certificate.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organic certificate">
              <Select value={form.organic_certification_id ?? ''} onChange={set('organic_certification_id')}>
                <option value="">None</option>
                {certs?.map((c) => <option key={c.id} value={c.id}>{c.certification_type} · {c.certification_number} ({c.is_expired ? 'expired' : c.status})</option>)}
              </Select>
            </Field>
            <Field label="GI record">
              <Select value={form.gi_record_id ?? ''} onChange={set('gi_record_id')}>
                <option value="">None</option>
                {gis?.map((g) => <option key={g.id} value={g.id}>{g.gi_product_name} ({g.record_type === 'application' ? 'application — no badge until registered' : g.verification_status.replace('_', ' ')})</option>)}
              </Select>
            </Field>
          </div>
          <Link to="/seller/certifications" className="inline-block text-sm font-semibold text-brand-700 hover:underline">Upload a certificate or GI document →</Link>
        </section>

        <section className="card flex items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Visible in marketplace</h2>
            <p className="text-sm text-muted">Turn off to hide this product without deleting it.</p>
          </div>
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="size-5 accent-brand-700" aria-label="Visible in marketplace" />
        </section>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="button" variant="outline" onClick={() => navigate('/seller/products')}>Cancel</Button>
          <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Submit for review'}</Button>
        </div>
      </form>
    </>
  )
}
