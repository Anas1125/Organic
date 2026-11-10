import { useEffect, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Button, ErrorBox, Field, Input, PageHeader, Spinner, StatusBadge, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { AccountForm } from '../buyer/Account'

const FIELDS = ['business_name', 'description', 'address', 'city', 'state', 'pincode', 'phone']

export default function SellerProfile() {
  const toast = useToast()
  const { refresh } = useAuth()
  const { data, setData, loading, error } = useFetch('/seller/profile')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (data) setForm(Object.fromEntries(FIELDS.map((k) => [k, data[k] || '']))) }, [data])

  if (loading || (!form && !error)) return <Spinner />
  if (error) return <ErrorBox message={error} />
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]))
      const { data: saved } = await api.put('/seller/profile', body)
      setData(saved)
      refresh()
      toast.success(data.status === 'rejected' ? 'Saved and sent for review again' : 'Business profile saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Profile settings" actions={<StatusBadge status={data.status} label={`Seller ${data.status}`} />} />
      <form onSubmit={save} className="card mb-6 space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">Business profile</h2>
        <p className="-mt-2 text-sm text-muted">Shown to buyers on your storefront.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business / farm name"><Input required minLength={2} value={form.business_name} onChange={set('business_name')} /></Field>
          <Field label="Business phone"><Input type="tel" pattern="[0-9+\- ]{7,20}" value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="About your business"><Textarea rows={4} value={form.description} onChange={set('description')} /></Field>
        <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="City"><Input value={form.city} onChange={set('city')} /></Field>
          <Field label="State"><Input value={form.state} onChange={set('state')} /></Field>
          <Field label="PIN code" className="col-span-2 sm:col-span-1"><Input inputMode="numeric" pattern="\d{6}" value={form.pincode} onChange={set('pincode')} /></Field>
        </div>
        <Button type="submit" loading={busy}>Save business profile</Button>
      </form>
      <AccountForm />
    </>
  )
}
