import { Building2, MailCheck, ShoppingBasket, Store, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../../api/client'
import { Logo } from '../../components/Brand'
import { Button, ErrorBox, Field, Input, PasswordInput, Textarea } from '../../components/ui'
import { homeFor, useAuth } from '../../context/AuthContext'
import { useSite } from '../../context/SiteContext'
import { useToast } from '../../context/ToastContext'

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col">
        <Logo light />
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">Genuine GI products.<br />Wholesale prices.</h2>
          <p className="mt-4 text-brand-100/80">Silk, crafts and foods with Geographical Indication tags, bought direct from the districts that make them.</p>
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
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [otp, setOtp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await login(form.email, form.password, form.remember)
      if (res.otp) return setOtp(res.otp)
      const u = res.user
      const from = location.state?.from
      navigate(from && u.role === 'buyer' ? from : homeFor(u), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (otp) {
    return (
      <AuthShell title="Check your email" subtitle="Enter the 6-digit code we sent to confirm it's you.">
        <OtpStep otp={otp} onBack={() => setOtp(null)} onDone={(u) => {
          const from = location.state?.from
          navigate(from && u.role === 'buyer' ? from : homeFor(u), { replace: true })
        }} />
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Welcome back" subtitle={`Log in to your ${site.site_name} account.`}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Email"><Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} className="size-4 rounded accent-brand-700" />
            Remember me
          </label>
          <Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to {site.site_name}? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  )
}

/** The 6-digit code screen shared by login and sign-up. */
function OtpStep({ otp, onDone, onBack }) {
  const { verifyOtp, resendOtp } = useAuth()
  const [current, setCurrent] = useState(otp)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(45)
  const [sent, setSent] = useState('')

  useEffect(() => {
    if (wait <= 0) return undefined
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const submit = async (e) => {
    e?.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    setError('')
    try {
      onDone(await verifyOtp(current.challenge, code, current.remember))
    } catch (err) {
      setError(errorMessage(err))
      setCode('')
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    setError('')
    try {
      const data = await resendOtp(current.challenge)
      setCurrent({ ...current, ...data })
      setSent('A new code is on its way.')
      setWait(45)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
        <MailCheck className="size-5 shrink-0 text-brand-700" />
        <p>We sent a 6-digit code to <strong>{current.email_hint}</strong>. It expires in 10 minutes — check spam if you don't see it.</p>
      </div>
      <ErrorBox message={error} />
      <Field label="Verification code">
        <input
          className="input h-14 text-center font-mono text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="6-digit code"
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Verify and continue</Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="font-medium text-muted hover:text-ink">← Back</button>
        {wait > 0
          ? <span className="text-muted">Resend code in {wait}s</span>
          : <button type="button" onClick={resend} className="font-semibold text-brand-700 hover:underline">Resend code</button>}
      </div>
      {sent && <p className="text-center text-xs text-brand-700">{sent}</p>}
    </form>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setSent((await api.post('/auth/forgot-password', { email })).data.detail)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900"><MailCheck className="size-5 shrink-0 text-brand-700" /><p>{sent} The link expires in 30 minutes. Check your spam folder too.</p></div>
          <Button to="/login" variant="outline" size="lg" className="w-full">Back to log in</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox message={error} />
          <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
          <p className="text-center text-sm text-muted"><Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to log in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const toast = useToast()
  const navigate = useNavigate()
  const [pw, setPw] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (pw.password !== pw.confirm) return setError('The two passwords don\'t match')
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, password: pw.password })
      toast.success('Password updated — please log in')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be logged out on other devices.">
      {!token ? (
        <div className="space-y-4 text-sm">
          <ErrorBox message="This reset link is incomplete. Please request a new one." />
          <Button to="/forgot-password" size="lg" className="w-full">Request a new link</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox message={error} />
          <Field label="New password" hint="At least 8 characters"><PasswordInput required minLength={8} maxLength={128} autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></Field>
          <Field label="Confirm new password"><PasswordInput required minLength={8} maxLength={128} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Save new password</Button>
          {error && /expired|invalid/i.test(error) && <p className="text-center text-sm"><Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Request a new link</Link></p>}
        </form>
      )}
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

function SellerSwitch() {
  const { user, logout } = useAuth()
  const { site } = useSite()
  return (
    <AuthShell title={`Sell on ${site.site_name}`} subtitle="Seller accounts are separate from shopping accounts.">
      <div className="space-y-4 text-sm">
        <p>
          You're signed in as <strong className="[overflow-wrap:anywhere]">{user.email}</strong>, which is a buyer account.
          To list products, log out and create a seller account with a different email.
        </p>
        <p className="text-muted">Your orders and cart stay safe in your buyer account — log back in any time.</p>
        <Button size="lg" className="w-full" onClick={logout}><Store className="size-5" /> Log out and create a seller account</Button>
        <Button size="lg" variant="outline" className="w-full" to="/shop">Keep shopping</Button>
      </div>
    </AuthShell>
  )
}

export function Register() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'buyer')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', buyer_type: 'wholesale' })
  const [seller, setSeller] = useState({ business_name: '', description: '', address: '', city: '', state: '', pincode: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [otp, setOtp] = useState(null)

  if (user) {
    // "Sell on …" while signed in as a buyer: seller accounts are separate, so explain.
    if (params.get('role') === 'seller' && user.role === 'buyer') return <SellerSwitch />
    return <Navigate to={homeFor(user)} replace />
  }

  if (otp) {
    return (
      <AuthShell title="Verify your email" subtitle="Enter the 6-digit code we sent to finish creating your account.">
        <OtpStep otp={otp} onBack={() => setOtp(null)} onDone={(u) => navigate(homeFor(u), { replace: true })} />
      </AuthShell>
    )
  }

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
      const res = await register(body)
      if (res.otp) return setOtp(res.otp)
      navigate(homeFor(res.user), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join as a business buyer or start selling your GI products.">
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
        <Field label="Password" hint="At least 8 characters"><PasswordInput required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>

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
