import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { titleCase } from '../../lib/format'

const VARIANTS = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 shadow-sm',
  secondary: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
  outline: 'border border-line bg-white text-ink hover:bg-brand-50',
  ghost: 'text-ink hover:bg-brand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  'danger-soft': 'bg-red-50 text-red-700 hover:bg-red-100',
}
const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'size-9',
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, to, ...props }) {
  const cls = `inline-flex items-center justify-center rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
  if (to) return <Link to={to} className={cls}>{children}</Link>
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span>
        : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const Input = (props) => <input className="input" {...props} />

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input className="input pr-11" {...props} type={show ? 'text' : 'password'} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
export const Textarea = (props) => <textarea className="input min-h-24" {...props} />
export const Select = ({ children, ...props }) => <select className="input pr-8" {...props}>{children}</select>

export function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Loader2 className="size-7 animate-spin text-brand-600" aria-label="Loading" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && <Button size="sm" variant="danger-soft" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

const STATUS_STYLES = {
  approved: 'bg-brand-100 text-brand-800',
  verified: 'bg-brand-100 text-brand-800',
  delivered: 'bg-brand-100 text-brand-800',
  paid: 'bg-brand-100 text-brand-800',
  active: 'bg-brand-100 text-brand-800',
  pending: 'bg-amber-50 text-amber-800',
  info_requested: 'bg-orange-50 text-orange-800',
  confirmed: 'bg-sky-50 text-sky-800',
  packed: 'bg-indigo-50 text-indigo-800',
  shipped: 'bg-violet-50 text-violet-800',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
  inactive: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
}

export function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label || titleCase(status)}
    </span>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-brand-50" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', to }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-800',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:shadow-lift">
      {Icon && <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></div>}
      <div className="min-w-0">
        <div className="text-xs font-medium leading-tight text-muted">{label}</div>
        <div className="mt-0.5 text-xl font-bold">{value}</div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            value === o.value ? 'bg-brand-800 text-white' : 'bg-white text-ink shadow-card hover:bg-brand-50'
          }`}
        >
          {o.label}
          {o.count != null && <span className={`ml-1.5 text-xs ${value === o.value ? 'text-white/70' : 'text-muted'}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
