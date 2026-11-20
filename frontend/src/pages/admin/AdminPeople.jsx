import { KeyRound, Search, Store, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { Button, EmptyState, ErrorBox, Field, Modal, PageHeader, PasswordInput, Spinner, StatusBadge, Tabs } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date, titleCase } from '../../lib/format'
import ReviewDialog from './ReviewDialog'

export function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const { data, setData, loading, error, reload } = useFetch('/admin/users', { role: role || undefined })
  const rows = (data || []).filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))

  const [pwFor, setPwFor] = useState(null)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const setPassword = async (e) => {
    e.preventDefault()
    setPwBusy(true)
    try {
      await api.put(`/admin/users/${pwFor.id}/password`, { password: pw })
      toast.success(`New password set for ${pwFor.email}`)
      setPwFor(null)
      setPw('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPwBusy(false)
    }
  }

  const toggle = async (u) => {
    if (u.is_active && !window.confirm(`Deactivate ${u.full_name}? They will be logged out and their products hidden.`)) return
    try {
      const { data: updated } = await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active })
      setData(data.map((x) => (x.id === u.id ? updated : x)))
      toast.success(updated.is_active ? 'User activated' : 'User deactivated')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="All registered buyers, sellers and admins." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={role} onChange={setRole} options={[{ value: '', label: 'All' }, { value: 'buyer', label: 'Buyers' }, { value: 'seller', label: 'Sellers' }, { value: 'admin', label: 'Admins' }]} />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={Users} title="No users found" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><div className="font-medium">{u.full_name}</div><div className="text-xs text-muted">{u.email}{u.phone && ` · ${u.phone}`}</div></td>
                  <td data-label="Role" className="capitalize">{u.role}</td>
                  <td data-label="Type" className="text-muted">{u.role === 'buyer' ? titleCase(u.buyer_type) : u.role === 'seller' ? titleCase(u.seller_status) : '—'}</td>
                  <td data-label="Joined" className="whitespace-nowrap text-muted">{date(u.created_at)}</td>
                  <td data-label="Status"><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      {me.is_owner && u.id !== me.id && (
                        <Button size="sm" variant="outline" onClick={() => { setPwFor(u); setPw('') }}><KeyRound className="size-4" /> Set password</Button>
                      )}
                      {u.id !== me.id && !u.is_owner && (u.role !== 'admin' || me.is_owner) && (
                        <Button size="sm" variant={u.is_active ? 'danger-soft' : 'secondary'} onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(pwFor)} onClose={() => setPwFor(null)} title="Set a new password"
        footer={<><Button variant="outline" onClick={() => setPwFor(null)}>Cancel</Button><Button type="submit" form="set-pw" loading={pwBusy}>Save password</Button></>}>
        {pwFor && (
          <form id="set-pw" onSubmit={setPassword} className="space-y-4 text-sm">
            <p>For <strong>{pwFor.full_name}</strong> <span className="text-muted [overflow-wrap:anywhere]">({pwFor.email})</span>. Their old password stops working straight away.</p>
            <Field label="New password" hint="At least 8 characters. Share it with them privately.">
              <PasswordInput required minLength={8} maxLength={128} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
          </form>
        )}
      </Modal>
    </>
  )
}

export function AdminSellers() {
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const { data, setData, loading, error, reload } = useFetch('/admin/sellers')
  const [rejecting, setRejecting] = useState(null)
  const [q, setQ] = useState('')

  const review = async (sp, status, reason) => {
    try {
      const { data: updated } = await api.patch(`/admin/sellers/${sp.id}/status`, { status, reason })
      setData(data.map((x) => (x.id === sp.id ? { ...x, ...updated } : x)))
      toast.success(`${sp.business_name} ${status}`)
      setRejecting(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  // Search business, owner, email, phone and place; the tab counts follow the search.
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (data || []).filter((x) => {
    const text = [x.business_name, x.owner_name, x.owner_email, x.phone, x.city, x.state, x.description].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
  const count = (s) => (data ? matches.filter((x) => x.status === s).length : undefined)
  const rows = matches.filter((x) => !tab || x.status === tab)

  return (
    <>
      <PageHeader title="Sellers" subtitle="Approve sellers before they can list products." />
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0"><Tabs value={tab} onChange={setTab} options={[
          { value: 'pending', label: 'Pending', count: count('pending') },
          { value: 'approved', label: 'Approved', count: count('approved') },
          { value: 'rejected', label: 'Rejected', count: count('rejected') },
          { value: '', label: 'All', count: data ? matches.length : undefined },
        ]} /></div>
        <div className="relative w-full shrink-0 xl:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" className="input pl-9" placeholder="Search business, owner, email or place" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim() && !q.trim()) setTab('') }} aria-label="Search sellers" />
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : !rows.length ? (
        <div className="card"><EmptyState icon={Store} title={q.trim() ? `No sellers match “${q.trim()}”` : 'No sellers here'} text={q.trim() && tab ? 'Try the All tab, or a different search.' : undefined} /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((sp) => (
            <div key={sp.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{sp.business_name}</div>
                  <div className="text-xs text-muted">{sp.owner_name} · {sp.owner_email}</div>
                </div>
                <StatusBadge status={sp.status} />
              </div>
              {sp.description && <p className="mt-3 line-clamp-3 text-sm text-ink/80">{sp.description}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted">Location</dt><dd className="font-medium">{[sp.city, sp.state].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt className="text-muted">Phone</dt><dd className="font-medium">{sp.phone || '—'}</dd></div>
                <div><dt className="text-muted">Products</dt><dd className="font-medium">{sp.product_count}</dd></div>
                <div><dt className="text-muted">Registered</dt><dd className="font-medium">{date(sp.created_at)}</dd></div>
              </dl>
              {sp.rejection_reason && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Rejected: {sp.rejection_reason}</div>}
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                {sp.status !== 'approved' && <Button size="sm" onClick={() => review(sp, 'approved')}>Approve</Button>}
                {sp.status !== 'rejected' && <Button size="sm" variant="danger-soft" onClick={() => setRejecting(sp)}>{sp.status === 'approved' ? 'Suspend' : 'Reject'}</Button>}
                {sp.status === 'approved' && <Link to={`/sellers/${sp.id}`} className="ml-auto self-center text-xs font-semibold text-brand-700 hover:underline">View store →</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
      <ReviewDialog open={Boolean(rejecting)} title={`Reject ${rejecting?.business_name || ''}`} onClose={() => setRejecting(null)} onSubmit={(reason) => review(rejecting, 'rejected', reason)} />
    </>
  )
}
