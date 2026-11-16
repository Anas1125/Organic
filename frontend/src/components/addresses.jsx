import { Check, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button, Field, Input } from './ui'

export const EMPTY_ADDRESS = {
  label: '', shipping_name: '', shipping_phone: '', shipping_address: '',
  shipping_city: '', shipping_state: '', shipping_pincode: '',
}

export const pickAddress = (a) => Object.fromEntries(Object.keys(EMPTY_ADDRESS).map((k) => [k, a?.[k] ?? '']))

/** The delivery address inputs, shared by checkout and the address book. */
export function AddressFields({ value, onChange, withLabel = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="space-y-3">
      {withLabel && (
        <Field label="Label" hint="Optional, e.g. Shop, Warehouse, Home"><Input maxLength={40} value={value.label || ''} onChange={set('label')} /></Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name"><Input required minLength={2} value={value.shipping_name} onChange={set('shipping_name')} autoComplete="name" /></Field>
        <Field label="Phone"><Input required type="tel" pattern="[0-9+\- ]{7,20}" value={value.shipping_phone} onChange={set('shipping_phone')} autoComplete="tel" /></Field>
      </div>
      <Field label="Address"><Input required minLength={5} value={value.shipping_address} onChange={set('shipping_address')} autoComplete="street-address" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="City"><Input required value={value.shipping_city} onChange={set('shipping_city')} autoComplete="address-level2" /></Field>
        <Field label="State"><Input required value={value.shipping_state} onChange={set('shipping_state')} autoComplete="address-level1" /></Field>
        <Field label="PIN code" className="col-span-2 sm:col-span-1"><Input required inputMode="numeric" pattern="\d{6}" title="6-digit PIN code" value={value.shipping_pincode} onChange={set('shipping_pincode')} autoComplete="postal-code" /></Field>
      </div>
    </div>
  )
}

export function AddressText({ a }) {
  return (
    <div className="min-w-0 text-sm">
      <div className="font-semibold">{a.shipping_name} <span className="font-normal text-muted">· {a.shipping_phone}</span></div>
      <div className="text-muted [overflow-wrap:anywhere]">{a.shipping_address}, {a.shipping_city}, {a.shipping_state} {a.shipping_pincode}</div>
    </div>
  )
}

/** Radio-style card used at checkout. */
export function AddressOption({ a, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition ${active ? 'border-brand-700 bg-brand-50' : 'border-line bg-white hover:border-brand-300'}`}>
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${active ? 'border-brand-700 bg-brand-700 text-white' : 'border-line'}`}>{active && <Check className="size-3" strokeWidth={3} />}</span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-brand-800">
          {a.label || 'Address'}{a.is_default && <span className="rounded-full bg-brand-100 px-1.5 py-px text-[10px]">Default</span>}
        </span>
        <AddressText a={a} />
      </span>
    </button>
  )
}

/** Manage saved addresses (Account page). */
export function AddressBook({ addresses, onChange }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | address id
  const [form, setForm] = useState(EMPTY_ADDRESS)
  const [busy, setBusy] = useState(false)

  const open = (a) => { setEditing(a ? a.id : 'new'); setForm(a ? pickAddress(a) : EMPTY_ADDRESS) }
  const run = async (fn, done) => {
    setBusy(true)
    try {
      await fn()
      onChange()
      toast.success(done)
      setEditing(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const save = (e) => {
    e.preventDefault()
    const current = addresses.find((a) => a.id === editing)
    run(
      () => (editing === 'new' ? api.post('/addresses', form) : api.put(`/addresses/${editing}`, { ...form, is_default: current?.is_default })),
      'Address saved',
    )
  }

  return (
    <div className="card space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand-700" /> Saved addresses</h2>
        {editing === null && addresses.length < 10 && <Button size="sm" variant="secondary" onClick={() => open(null)}><Plus className="size-4" /> Add address</Button>}
      </div>
      {!addresses.length && editing === null && <p className="text-sm text-muted">No saved addresses yet. Addresses you use at checkout can be saved here for next time.</p>}
      <div className="space-y-3">
        {addresses.map((a) => editing === a.id ? null : (
          <div key={a.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-line p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-brand-800">{a.label || 'Address'}{a.is_default && <span className="rounded-full bg-brand-100 px-1.5 py-px text-[10px]">Default</span>}</div>
              <AddressText a={a} />
            </div>
            <div className="flex shrink-0 gap-1">
              {!a.is_default && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.put(`/addresses/${a.id}`, { ...pickAddress(a), is_default: true }), 'Default address updated')}><Star className="size-4" /> Make default</Button>}
              <button type="button" onClick={() => open(a)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-brand-50 hover:text-ink" aria-label="Edit address"><Pencil className="size-4" /></button>
              <button type="button" onClick={() => window.confirm('Delete this address?') && run(() => api.delete(`/addresses/${a.id}`), 'Address deleted')} className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label="Delete address"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {editing !== null && (
        <form onSubmit={save} className="space-y-4 rounded-xl bg-canvas p-4">
          <AddressFields value={form} onChange={setForm} withLabel />
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>Save address</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  )
}
