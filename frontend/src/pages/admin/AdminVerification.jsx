import { BadgeCheck, FileText, Leaf } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage, openDocument } from '../../api/client'
import { Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { GI_STATUS_LABELS, GI_TYPES, date } from '../../lib/format'

function ReviewModal({ item, onClose, children, onSubmit, title }) {
  const [busy, setBusy] = useState(false)
  if (!item) return null
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(new FormData(e.currentTarget)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {children}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save review</Button></div>
      </form>
    </Modal>
  )
}

const viewDoc = (toast, path) => openDocument(path).catch((e) => toast.error(errorMessage(e)))

export function AdminOrganic() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const { data, setData, loading, error, reload } = useFetch('/admin/certifications')
  const [reviewing, setReviewing] = useState(null)
  const count = (s) => data?.filter((x) => x.status === s).length
  const rows = (data || []).filter((c) => !tab || c.status === tab)

  const submit = async (fd) => {
    try {
      const { data: c } = await api.patch(`/admin/certifications/${reviewing.id}`, { status: fd.get('status'), admin_notes: fd.get('admin_notes') || null })
      setData(data.map((x) => (x.id === c.id ? c : x)))
      toast.success('Certificate review saved')
      setReviewing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Organic certifications" subtitle="Open the document, check the number, authority and dates, then approve or reject." />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} options={[
        { value: 'pending', label: 'Pending', count: count('pending') },
        { value: 'approved', label: 'Approved', count: count('approved') },
        { value: 'rejected', label: 'Rejected', count: count('rejected') },
        { value: '', label: 'All', count: data?.length },
      ]} /></div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={Leaf} title="Nothing here" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Seller</th><th>Certificate</th><th>Authority</th><th>Valid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap font-medium">{c.seller_name}</td>
                  <td><div>{c.certification_type}</div><div className="text-xs text-muted">No. {c.certification_number}</div></td>
                  <td>{c.issuing_authority}</td>
                  <td className="whitespace-nowrap text-xs">{date(c.issue_date)} – {date(c.expiry_date)}{c.is_expired && <div className="font-semibold text-red-600">Expired</div>}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="whitespace-nowrap text-right">
                    {c.has_document && <Button size="sm" variant="outline" className="mr-2" onClick={() => viewDoc(toast, `/documents/certifications/${c.id}`)}><FileText className="size-3.5" /> View</Button>}
                    <Button size="sm" onClick={() => setReviewing(c)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReviewModal item={reviewing} onClose={() => setReviewing(null)} onSubmit={submit} title="Review organic certificate">
        {reviewing && <>
          <div className="rounded-xl bg-canvas p-3 text-sm"><strong>{reviewing.certification_type}</strong> · {reviewing.certification_number}<br /><span className="text-muted">{reviewing.seller_name} · {reviewing.issuing_authority}</span></div>
          <Field label="Decision">
            <Select name="status" defaultValue={reviewing.status}>
              <option value="pending">Pending</option><option value="approved">Approve</option><option value="rejected">Reject</option>
            </Select>
          </Field>
          <Field label="Note to seller" hint="Required if rejecting — explain what’s wrong."><Textarea name="admin_notes" rows={3} maxLength={500} defaultValue={reviewing.admin_notes || ''} /></Field>
        </>}
      </ReviewModal>
    </>
  )
}

function GIDecision({ record }) {
  const [decision, setDecision] = useState(record.verification_status)
  const needsNote = decision === 'rejected' || decision === 'info_requested'
  return (
    <>
      <Field label="Decision">
        <Select name="verification_status" value={decision} onChange={(e) => setDecision(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="verified" disabled={!record.has_document}>Verify{!record.has_document ? ' (needs a document)' : ''}</option>
          <option value="info_requested">Request more information</option>
          <option value="rejected">Reject</option>
        </Select>
      </Field>
      {decision === 'verified' && record.record_type === 'application' && (
        <p className="rounded-xl bg-canvas p-3 text-xs text-muted">This is an application, not a registered GI. Verifying confirms the application is genuine — products will <strong>not</strong> show the GI badge until it is registered.</p>
      )}
      <Field label="Application status" hint="e.g. Filed, Examined, Published, Registered"><Input name="application_status" maxLength={60} defaultValue={record.application_status || ''} /></Field>
      <Field label={needsNote ? 'Note to seller (required)' : 'Note to seller'} hint={decision === 'info_requested' ? 'Tell the seller exactly what to send or correct.' : undefined}>
        <Textarea name="admin_notes" rows={3} maxLength={500} required={needsNote} defaultValue={record.admin_notes || ''} />
      </Field>
    </>
  )
}

export function AdminGI() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [type, setType] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/admin/gi-records')
  const [reviewing, setReviewing] = useState(null)
  const count = (s) => data?.filter((x) => x.verification_status === s).length
  const rows = (data || []).filter((g) => (!tab || g.verification_status === tab) && (!type || g.record_type === type))

  const submit = async (fd) => {
    try {
      const { data: g } = await api.patch(`/admin/gi-records/${reviewing.id}`, {
        verification_status: fd.get('verification_status'),
        application_status: fd.get('application_status'),
        admin_notes: fd.get('admin_notes') || null,
      })
      setData(data.map((x) => (x.id === g.id ? g : x)))
      toast.success('GI review saved')
      setReviewing(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="GI documents" subtitle="Verify registered GI products, authorised users and GI applications. Only registered products and authorised users can earn the GI badge." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} options={[
          { value: 'pending', label: 'Pending', count: count('pending') },
          { value: 'info_requested', label: 'Info requested', count: count('info_requested') },
          { value: 'verified', label: 'Verified', count: count('verified') },
          { value: 'rejected', label: 'Rejected', count: count('rejected') },
          { value: '', label: 'All', count: data?.length },
        ]} />
        <div className="sm:w-56">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Record type">
            <option value="">All record types</option>
            {Object.entries(GI_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={BadgeCheck} title="Nothing here" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>GI product</th><th>Type</th><th>Seller</th><th>Region</th><th>Application</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div className="font-medium">{g.gi_product_name}</div>
                    <div className="text-xs text-muted">{g.record_type === 'application' ? 'App.' : 'Reg.'} no. {g.registration_number || '—'}</div>
                    {g.authorised_user_number && <div className="text-xs text-muted">AU no. {g.authorised_user_number}</div>}
                  </td>
                  <td className="text-xs">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${g.record_type === 'application' ? 'bg-sky-50 text-sky-800' : g.record_type === 'authorised_user' ? 'bg-violet-50 text-violet-800' : 'bg-amber-50 text-amber-800'}`}>
                      {{ registered_product: 'Registered', application: 'Application', authorised_user: 'Authorised user' }[g.record_type]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{g.seller_name}</td>
                  <td>{g.geographical_region}</td>
                  <td className="text-xs">{g.application_status || '—'}{g.applicant_association && <div className="text-muted">{g.applicant_association}</div>}</td>
                  <td>
                    <StatusBadge status={g.verification_status} label={GI_STATUS_LABELS[g.verification_status]} />
                    {g.reviewed_by_name && <div className="mt-1 text-[11px] text-muted">by {g.reviewed_by_name}, {date(g.reviewed_at)}</div>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {g.has_document ? <Button size="sm" variant="outline" className="mr-2" onClick={() => viewDoc(toast, `/documents/gi-records/${g.id}`)}><FileText className="size-3.5" /> View</Button>
                      : <span className="mr-2 text-xs text-muted">No document</span>}
                    <Button size="sm" onClick={() => setReviewing(g)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReviewModal item={reviewing} onClose={() => setReviewing(null)} onSubmit={submit} title="Review GI record">
        {reviewing && <>
          <div className="space-y-1 rounded-xl bg-canvas p-3 text-sm">
            <div><strong>{reviewing.gi_product_name}</strong> · {GI_TYPES[reviewing.record_type]}</div>
            <div className="text-muted">{reviewing.seller_name} · {reviewing.geographical_region}</div>
            <div className="text-muted">{reviewing.record_type === 'application' ? 'Application' : 'Registration'} no. {reviewing.registration_number || '—'}{reviewing.authorised_user_number && ` · Authorised user no. ${reviewing.authorised_user_number}`}</div>
            {reviewing.has_document && <button type="button" onClick={() => viewDoc(toast, `/documents/gi-records/${reviewing.id}`)} className="text-sm font-semibold text-brand-700 hover:underline">Open supporting document →</button>}
          </div>
          {reviewing.seller_notes && <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900"><strong>Seller says:</strong> {reviewing.seller_notes}</div>}
          <GIDecision record={reviewing} />
        </>}
      </ReviewModal>
    </>
  )
}
