import { Crown, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Button, EmptyState, ErrorBox, Field, Input, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import useFetch from '../../hooks/useFetch'
import { date } from '../../lib/format'
import { AccountForm } from '../buyer/Account'

const EMPTY = { full_name: '', email: '', password: '' }

/** Main admin only: add and remove admin accounts. */
export function AdminAdmins() {
  const { user: me } = useAuth()
  const toast = useToast()
  const { data, setData, loading, error, reload } = useFetch(me.is_owner ? '/admin/admins' : null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (!me.is_owner) {
    return (
      <div className="card">
        <EmptyState icon={ShieldCheck} title="Main admin only" text="Only the main admin account can add or remove admins." />
      </div>
    )
  }

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data: created } = await api.post('/admin/admins', form)
      setData([...(data || []), created])
      setForm(EMPTY)
      toast.success(`${created.full_name} can now log in as an admin`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a) => {
    if (!window.confirm(`Remove admin ${a.full_name} (${a.email})? They will lose access immediately.`)) return
    try {
      await api.delete(`/admin/admins/${a.id}`)
      setData(data.filter((x) => x.id !== a.id))
      toast.success('Admin removed')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Admins" subtitle="People who can manage the marketplace. Only you, the main admin, can add or remove them." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? <Spinner /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Admin</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {data.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {a.full_name}
                          {a.is_owner && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><Crown className="size-3" /> Main admin</span>}
                          {a.id === me.id && <span className="text-xs text-muted">(you)</span>}
                        </div>
                        <div className="text-xs text-muted [overflow-wrap:anywhere]">{a.email}</div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{date(a.created_at)}</td>
                      <td className="text-right">
                        {!a.is_owner && (
                          <Button size="sm" variant="danger-soft" onClick={() => remove(a)}><Trash2 className="size-4" /> Remove</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form onSubmit={add} className="card space-y-4 p-5 sm:p-6 lg:self-start">
          <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-4" /> Add an admin</h2>
          <Field label="Full name"><Input required minLength={2} maxLength={120} value={form.full_name} onChange={set('full_name')} /></Field>
          <Field label="Email" hint="They log in with this."><Input type="email" required value={form.email} onChange={set('email')} autoComplete="off" /></Field>
          <Field label="Password" hint="At least 8 characters. Share it with them privately; they can change it under My account.">
            <Input type="password" required minLength={8} maxLength={128} value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={busy} className="w-full">Add admin</Button>
        </form>
      </div>
    </>
  )
}

/** Any admin: own name, login email and password. */
export function AdminMyAccount() {
  const { user } = useAuth()
  return (
    <>
      <PageHeader
        title="My account"
        subtitle={user.is_owner ? 'You are the main admin. Use your own email and a strong password here.' : 'Your admin login details.'}
      />
      <AccountForm />
    </>
  )
}
