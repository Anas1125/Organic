import { ImagePlus, MapPin, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { LeafMark, Logo } from '../../components/Brand'
import { Button, Field, Input, PageHeader, Textarea } from '../../components/ui'
import { useSite } from '../../context/SiteContext'
import { useToast } from '../../context/ToastContext'

export default function SiteSettings() {
  const { site, setSite, loaded } = useSite()
  const toast = useToast()
  const toForm = (s) => ({
    site_name: s.site_name,
    tagline: s.tagline || '',
    contact_email: s.contact_email || '',
    contact_phone: s.contact_phone || '',
    contact_hours: s.contact_hours || '',
    locations: s.locations?.length ? s.locations : [''],
  })
  const [form, setForm] = useState(() => toForm(site))
  const [busy, setBusy] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setLocation = (i, v) => setForm({ ...form, locations: form.locations.map((l, j) => (j === i ? v : l)) })
  const removeLocation = (i) => setForm({ ...form, locations: form.locations.filter((_, j) => j !== i) })

  // Reload the form when settings arrive from the server (first load).
  useEffect(() => { if (loaded) setForm(toForm(site)) }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    setBusy('text')
    try {
      const { data } = await api.put('/admin/site-settings', {
        ...form,
        locations: form.locations.filter((l) => l.trim()),
      })
      setSite(data)
      setForm(toForm(data))
      toast.success('Site settings saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const upload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy('logo')
    try {
      const fd = new FormData()
      fd.append('file', file)
      setSite((await api.post('/admin/site-settings/logo', fd)).data)
      toast.success('Logo updated')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const reset = async () => {
    if (!window.confirm('Remove the uploaded logo and use the default leaf?')) return
    setBusy('reset')
    try {
      setSite((await api.delete('/admin/site-settings/logo')).data)
      toast.success('Default logo restored')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHeader title="Site settings" subtitle="Your logo, site name and footer text. Changes show across the whole site straight away." />

      <section className="card mb-5 p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Preview</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-20 items-center rounded-2xl border border-line bg-white px-5"><Logo asLink={false} /></div>
          <div className="flex h-20 items-center rounded-2xl bg-brand-900 px-5"><Logo asLink={false} light /></div>
        </div>
        <p className="mt-2 text-xs text-muted">Header (left) and footer (right).</p>
      </section>

      <section className="card mb-5 p-5 sm:p-6">
        <h2 className="font-semibold">Logo</h2>
        <p className="mb-4 text-sm text-muted">PNG, JPG or WebP up to 5 MB. A square or wide image with a transparent background works best. Shown at 32 px tall.</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-20 place-items-center rounded-2xl border border-line bg-canvas p-2">
            {site.logo_url ? <img src={site.logo_url} alt="Current logo" className="max-h-full max-w-full object-contain" /> : <LeafMark className="size-10" />}
          </div>
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-brand-800 px-4 text-sm font-semibold text-white hover:bg-brand-900 ${busy === 'logo' ? 'opacity-60' : ''}`}>
            <ImagePlus className="size-4" /> {busy === 'logo' ? 'Uploading…' : 'Upload new logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} disabled={busy === 'logo'} />
          </label>
          {site.logo_url && (
            <Button variant="outline" onClick={reset} loading={busy === 'reset'}><RotateCcw className="size-4" /> Use default logo</Button>
          )}
        </div>
      </section>

      <form onSubmit={save} className="space-y-5">
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Text</h2>
          <Field label="Site name" hint="Shown next to the logo, in the browser tab and around the site.">
            <Input required maxLength={60} value={form.site_name} onChange={set('site_name')} />
          </Field>
          <Field label="Footer description" hint="Optional. Up to 300 characters.">
            <Textarea rows={3} maxLength={300} value={form.tagline} onChange={set('tagline')} />
          </Field>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Contact details</h2>
            <p className="text-sm text-muted">Shown on the Contact page and in the footer. Leave a field empty to hide it.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><Input type="email" maxLength={255} value={form.contact_email} onChange={set('contact_email')} placeholder="support@yourdomain.com" /></Field>
            <Field label="Mobile number"><Input type="tel" pattern="[0-9+\-() ]{7,30}" title="Digits, spaces, +, - and brackets" value={form.contact_phone} onChange={set('contact_phone')} placeholder="+91 98765 43210" /></Field>
          </div>
          <Field label="Working hours" hint="Optional, e.g. Mon–Sat, 9am–6pm IST"><Input maxLength={120} value={form.contact_hours} onChange={set('contact_hours')} /></Field>
          <div>
            <span className="label">Locations</span>
            <div className="space-y-2">
              {form.locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted" />
                  <Input maxLength={200} value={loc} onChange={(e) => setLocation(i, e.target.value)} placeholder="e.g. 12 Anna Salai, Chennai, Tamil Nadu" aria-label={`Location ${i + 1}`} />
                  <button type="button" onClick={() => removeLocation(i)} className="grid size-9 shrink-0 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label={`Remove location ${i + 1}`}><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            {form.locations.length < 10 && (
              <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => setForm({ ...form, locations: [...form.locations, ''] })}>
                <Plus className="size-4" /> Add location
              </Button>
            )}
            <p className="mt-2 text-xs text-muted">Up to 10. Each one links to Google Maps on the site.</p>
          </div>
        </section>

        <div className="flex justify-end"><Button type="submit" size="lg" loading={busy === 'text'}>Save settings</Button></div>
      </form>
    </>
  )
}
