import { BadgeCheck, FileText, Leaf, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage, openDocument } from '../../api/client'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { GI_NUMBER_LABEL, GI_STATUS_LABELS, GI_TYPES, date } from '../../lib/format'
import { useSite } from '../../context/SiteContext'

function useDoc() {
  const toast = useToast()
  return (path) => openDocument(path).catch((e) => toast.error(errorMessage(e)))
}

function UploadForm({ fields, endpoint, fileRequired, onDone, onCancel }) {
  const { site } = useSite()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)
      const file = fd.get('document')
      if (file && !file.size) fd.delete('document')
      for (const [k, v] of [...fd.entries()]) if (v === '') fd.delete(k)
      onDone((await api.post(endpoint, fd)).data)
      toast.success('Submitted for verification')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox message={error} />
      {fields}
      <Field label={`Supporting document${fileRequired ? '' : ' (optional)'}`} hint={`PDF, JPG or PNG, max 10 MB. Only you and ${site.site_name} admins can see it.`}>
        <input name="document" type="file" required={fileRequired} accept="application/pdf,image/jpeg,image/png,image/webp" className="input file:mr-3 file:rounded-full file:border-0 file:bg-brand-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-800" />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy}>Submit</Button>
      </div>
    </form>
  )
}

function OrganicSection() {
  const toast = useToast()
  const view = useDoc()
  const { data, setData, loading, error, reload } = useFetch('/seller/certifications')
  const [adding, setAdding] = useState(false)

  const remove = async (c) => {
    if (!window.confirm('Delete this certificate? Products linked to it will lose the Organic badge.')) return
    try {
      await api.delete(`/seller/certifications/${c.id}`)
      setData(data.filter((x) => x.id !== c.id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Leaf className="size-5 text-brand-700" /> Organic certificates</h2>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add</Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={Leaf} title="No organic certificates" text="Upload your NPOP, PGS-India or other organic certificate to earn the Organic badge." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.certification_type}</div>
                  <div className="text-sm text-muted">No. {c.certification_number}</div>
                </div>
                {c.is_expired ? <StatusBadge status="expired" /> : <StatusBadge status={c.status} />}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">Issued by</dt><dd className="font-medium">{c.issuing_authority}</dd></div>
                <div><dt className="text-muted">Valid</dt><dd className="font-medium">{date(c.issue_date)} – {date(c.expiry_date)}</dd></div>
              </dl>
              {c.admin_notes && <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs"><strong>Admin note:</strong> {c.admin_notes}</div>}
              <div className="mt-4 flex gap-2">
                {c.has_document && <Button size="sm" variant="outline" onClick={() => view(`/documents/certifications/${c.id}`)}><FileText className="size-3.5" /> Document</Button>}
                <Button size="sm" variant="danger-soft" onClick={() => remove(c)}><Trash2 className="size-3.5" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add organic certificate">
        <UploadForm
          endpoint="/seller/certifications"
          fileRequired
          onCancel={() => setAdding(false)}
          onDone={(c) => { setData([c, ...(data || [])]); setAdding(false) }}
          fields={<>
            <Field label="Certification type"><Input name="certification_type" required list="cert-types" placeholder="e.g. NPOP (India Organic)" /></Field>
            <datalist id="cert-types"><option value="NPOP (India Organic)" /><option value="PGS-India Organic" /><option value="Jaivik Bharat" /><option value="USDA Organic" /><option value="EU Organic" /></datalist>
            <Field label="Certificate number"><Input name="certification_number" required maxLength={80} /></Field>
            <Field label="Issuing authority"><Input name="issuing_authority" required maxLength={150} placeholder="Certification body name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date"><Input name="issue_date" type="date" /></Field>
              <Field label="Expiry date"><Input name="expiry_date" type="date" /></Field>
            </div>
          </>}
        />
      </Modal>
    </section>
  )
}

const GI_EMPTY = {
  record_type: 'registered_product', gi_product_name: '', registration_number: '', authorised_user_number: '',
  geographical_region: '', applicant_association: '', application_status: '', seller_notes: '',
}

/** Add or edit a GI record. Editing always sends it back to the admin for review. */
function GIForm({ record, onDone, onCancel }) {
  const { site } = useSite()
  const toast = useToast()
  const editing = Boolean(record)
  const [form, setForm] = useState(() => (record ? Object.fromEntries(Object.keys(GI_EMPTY).map((k) => [k, record[k] ?? ''])) : GI_EMPTY))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const type = form.record_type

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => v !== '' && fd.append(k, v))
      const file = e.currentTarget.document.files[0]
      if (file) fd.append('document', file)
      const { data } = editing ? await api.put(`/seller/gi-records/${record.id}`, fd) : await api.post('/seller/gi-records', fd)
      toast.success(editing ? 'Updated and sent for review' : 'Submitted for verification')
      onDone(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox message={error} />
      {editing && record.verification_status === 'info_requested' && record.admin_notes && (
        <div className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900"><strong>Admin asked:</strong> {record.admin_notes}</div>
      )}
      <Field label="Record type">
        <Select value={type} onChange={set('record_type')}>
          {Object.entries(GI_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      {type === 'application' && (
        <p className="rounded-xl bg-canvas p-3 text-xs text-muted">Applications are recorded and reviewed, but products only get the GI badge once the GI is registered. Update this record when your registration comes through.</p>
      )}
      <Field label="GI product name"><Input required maxLength={150} value={form.gi_product_name} onChange={set('gi_product_name')} placeholder="e.g. Madurai Malli" /></Field>
      <Field label={GI_NUMBER_LABEL[type]}><Input required maxLength={80} value={form.registration_number} onChange={set('registration_number')} /></Field>
      {type === 'authorised_user' && (
        <Field label="Authorised user registration number" hint="The number on your authorised-user certificate.">
          <Input required maxLength={80} value={form.authorised_user_number} onChange={set('authorised_user_number')} />
        </Field>
      )}
      <Field label="Geographical region"><Input required maxLength={150} value={form.geographical_region} onChange={set('geographical_region')} /></Field>
      <Field label={type === 'application' ? 'Applicant / producer association' : 'Registered proprietor / association'}><Input maxLength={200} value={form.applicant_association} onChange={set('applicant_association')} /></Field>
      <Field label="Application status" hint="e.g. Filed, Examined, Published, Registered"><Input maxLength={60} value={form.application_status} onChange={set('application_status')} /></Field>
      {editing && (
        <Field label="Note to admin" hint="Optional — explain what you changed."><Textarea rows={2} maxLength={500} value={form.seller_notes} onChange={set('seller_notes')} /></Field>
      )}
      <Field
        label={editing ? 'Replace document (optional)' : 'Supporting document'}
        hint={`PDF, JPG or PNG, max 10 MB. Only you and ${site.site_name} admins can see it. Records can't be verified without one.`}
      >
        <input name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input file:mr-3 file:rounded-full file:border-0 file:bg-brand-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-800" />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy}>{editing ? 'Save & resubmit' : 'Submit'}</Button>
      </div>
    </form>
  )
}

function GISection() {
  const toast = useToast()
  const view = useDoc()
  const { data, setData, loading, error, reload } = useFetch('/seller/gi-records')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, record = edit

  const remove = async (g) => {
    if (!window.confirm('Delete this GI record? Linked products will lose the GI badge.')) return
    try {
      await api.delete(`/seller/gi-records/${g.id}`)
      setData(data.filter((x) => x.id !== g.id))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const saved = (g) => {
    setData(editing?.id ? data.map((x) => (x.id === g.id ? g : x)) : [g, ...(data || [])])
    setEditing(null)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><BadgeCheck className="size-5 text-amber-700" /> GI records</h2>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="size-4" /> Add</Button>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !data.length ? (
        <div className="card"><EmptyState icon={BadgeCheck} title="No GI records" text="Add a registered GI product, your authorised-user registration, or a GI application you’ve filed." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((g) => (
            <div key={g.id} className={`card p-5 ${g.verification_status === 'info_requested' ? 'ring-2 ring-orange-200' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{g.gi_product_name}</div>
                  <div className="text-sm text-muted">{GI_TYPES[g.record_type]}</div>
                </div>
                <StatusBadge status={g.verification_status} label={GI_STATUS_LABELS[g.verification_status]} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">{GI_NUMBER_LABEL[g.record_type].replace(' (of the registered GI)', '')}</dt><dd className="font-medium">{g.registration_number || '—'}</dd></div>
                {g.record_type === 'authorised_user' && <div><dt className="text-muted">Authorised user no.</dt><dd className="font-medium">{g.authorised_user_number || '—'}</dd></div>}
                <div><dt className="text-muted">Region</dt><dd className="font-medium">{g.geographical_region}</dd></div>
                <div><dt className="text-muted">Application status</dt><dd className="font-medium">{g.application_status || '—'}</dd></div>
              </dl>
              {g.verification_status === 'verified' && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${g.can_show_badge ? 'bg-brand-50 text-brand-800' : 'bg-canvas text-muted'}`}>
                  {g.can_show_badge ? 'Linked products show the GI badge.' : 'Verified as a genuine application. The GI badge appears once the GI is registered.'}
                </div>
              )}
              {g.admin_notes && g.verification_status !== 'verified' && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${g.verification_status === 'info_requested' ? 'bg-orange-50 text-orange-900' : 'bg-canvas'}`}>
                  <strong>Admin note:</strong> {g.admin_notes}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {g.verification_status === 'info_requested'
                  ? <Button size="sm" onClick={() => setEditing(g)}>Update & resubmit</Button>
                  : <Button size="sm" variant="outline" onClick={() => setEditing(g)}><Pencil className="size-3.5" /> Edit</Button>}
                {g.has_document && <Button size="sm" variant="outline" onClick={() => view(`/documents/gi-records/${g.id}`)}><FileText className="size-3.5" /> Document</Button>}
                <Button size="sm" variant="danger-soft" onClick={() => remove(g)}><Trash2 className="size-3.5" /> Delete</Button>
              </div>
              {g.verification_status === 'verified' && <p className="mt-2 text-[11px] text-muted">Editing a verified record sends it back for review.</p>}
            </div>
          ))}
        </div>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Update GI record' : 'Add GI record'}>
        {editing && <GIForm record={editing.id ? editing : null} onDone={saved} onCancel={() => setEditing(null)} />}
      </Modal>
    </section>
  )
}

export default function Certifications() {
  return (
    <>
      <PageHeader title="Certifications & GI" subtitle="Uploading a document does not add a badge by itself — our team verifies each one first." />
      <div className="space-y-10">
        <OrganicSection />
        <GISection />
      </div>
    </>
  )
}
