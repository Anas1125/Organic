import { Building2, ShoppingBasket, Store, User } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { Logo } from '../../components/Brand'
import { Button, ErrorBox, Field, Input, Textarea } from '../../components/ui'
import { homeFor, useAuth } from '../../context/AuthContext'
import { useSite } from '../../context/SiteContext'

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col">
        <Logo light />
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">Good food.<br />Better choices.</h2>
          <p className="mt-4 text-brand-100/80">Organic and traditional food from verified farmers and makers across India.</p>
        </div>
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand-700/50" />
        <div className="absolute -bottom-32 right-20 size-72 rounded-full bg-brand-900/60" />
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto my-auto w-full max-w-md py-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { site } = useSite()
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(form.email, form.password)
      const from = location.state?.from
      navigate(from && u.role === 'buyer' ? from : homeFor(u), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle={`Log in to your ${site.site_name} account.`}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><Input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to {site.site_name}? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  )
}

function RoleOption({ active, onClick, icon: Icon, title, text }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-1 items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${active ? 'border-brand-700 bg-brand-50' : 'border-line bg-white hover:border-brand-300'}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${active ? 'text-brand-700' : 'text-muted'}`} />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{text}</div>
      </div>
    </button>
  )
}

export function Register() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'buyer')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', buyer_type: 'individual' })
  const [seller, setSeller] = useState({ business_name: '', description: '', address: '', city: '', state: '', pincode: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setS = (k) => (e) => setSeller({ ...seller, [k]: e.target.value })
  const blankToNull = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { ...form, phone: form.phone || null, role }
      if (role === 'seller') body.seller = blankToNull(seller)
      const u = await register(body)
      navigate(homeFor(u), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join as a buyer or start selling your produce.">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3">
          <RoleOption active={role === 'buyer'} onClick={() => setRole('buyer')} icon={ShoppingBasket} title="I want to buy" text="Shop from verified sellers" />
          <RoleOption active={role === 'seller'} onClick={() => setRole('seller')} icon={Store} title="I want to sell" text="List your products" />
        </div>
        <ErrorBox message={error} />
        <Field label="Full name"><Input required minLength={2} autoComplete="name" value={form.full_name} onChange={set('full_name')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone" hint="Optional"><Input type="tel" autoComplete="tel" pattern="[0-9+\- ]{7,20}" value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="Password" hint="At least 8 characters"><Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>

        {role === 'buyer' && (
          <div>
            <span className="label">Buying for</span>
            <div className="flex gap-3">
              <RoleOption active={form.buyer_type === 'individual'} onClick={() => setForm({ ...form, buyer_type: 'individual' })} icon={User} title="My home" text="Individual customer" />
              <RoleOption active={form.buyer_type === 'wholesale'} onClick={() => setForm({ ...form, buyer_type: 'wholesale' })} icon={Building2} title="My business" text="Wholesale / shop" />
            </div>
          </div>
        )}

        {role === 'seller' && (
          <div className="space-y-4 rounded-2xl bg-brand-50 p-4">
            <div className="text-sm font-semibold text-brand-800">Business details</div>
            <Field label="Business / farm name"><Input required minLength={2} value={seller.business_name} onChange={setS('business_name')} /></Field>
            <Field label="About your business" hint="What you grow or make, and how"><Textarea rows={3} value={seller.description} onChange={setS('description')} /></Field>
            <Field label="Address"><Input value={seller.address} onChange={setS('address')} /></Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="City"><Input value={seller.city} onChange={setS('city')} /></Field>
              <Field label="State"><Input value={seller.state} onChange={setS('state')} /></Field>
              <Field label="PIN code" className="col-span-2 sm:col-span-1"><Input inputMode="numeric" pattern="\d{6}" value={seller.pincode} onChange={setS('pincode')} /></Field>
            </div>
            <p className="text-xs text-muted">Our team reviews new sellers before you can list products. You can upload certificates while you wait.</p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
      </p>
    </AuthShell>
  )
}
