import { Phone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Accounts made before the phone number was required: ask them to add one. */
export default function PhoneReminder({ className = '' }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user || user.phone || !['buyer', 'seller'].includes(user.role)) return null
  const to = user.role === 'seller' ? '/seller/profile' : '/account'
  if (pathname === to) return null
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      <Phone className="size-4 shrink-0" />
      <span className="min-w-0 flex-1"><strong>Add your mobile number.</strong> Our team calls to confirm {user.role === 'seller' ? 'orders and payouts' : 'your orders'}.</span>
      <Link to={to} className="rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-950">Add number</Link>
    </div>
  )
}
