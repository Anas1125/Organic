import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Button, Field, Input, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

/** Profile + password form. Used by buyers, and inside seller/admin settings. */
export function AccountForm() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '', buyer_type: user.buyer_type })
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [busy, setBusy] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy('profile')
    try {
      const body = { full_name: form.full_name, phone: form.phone || null }
      if (user.role === 'buyer') body.buyer_type = form.buyer_type
      setUser((await api.patch('/auth/me', body)).data)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const changePw = async (e) => {
    e.preventDefault()
    setBusy('pw')
    try {
      await api.patch('/auth/me', pw)
      setPw({ current_password: '', new_password: '' })
      toast.success('Password changed')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">Personal details</h2>
        <Field label="Email"><Input value={user.email} disabled /></Field>
        <Field label="Full name"><Input required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Phone"><Input type="tel" pattern="[0-9+\- ]{7,20}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {user.role === 'buyer' && (
          <Field label="Account type">
            <Select value={form.buyer_type} onChange={(e) => setForm({ ...form, buyer_type: e.target.value })}>
              <option value="individual">Individual customer</option>
              <option value="wholesale">Wholesale buyer</option>
            </Select>
          </Field>
        )}
        <Button type="submit" loading={busy === 'profile'}>Save changes</Button>
      </form>
      <form onSubmit={changePw} className="card space-y-4 p-5 sm:p-6 lg:self-start">
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password"><Input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters"><Input type="password" required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
        <Button type="submit" variant="secondary" loading={busy === 'pw'}>Update password</Button>
      </form>
    </div>
  )
}

export default function Account() {
  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">My profile</h1>
      <AccountForm />
    </div>
  )
}
