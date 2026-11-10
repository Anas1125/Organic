import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Brand'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout({ title, nav, banner }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="rounded-full p-2 hover:bg-brand-50 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-brand-800 text-white shadow-sm' : 'text-ink/75 hover:bg-brand-50 hover:text-ink'
              }`
            }
          >
            <Icon className="size-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink/75 hover:bg-brand-50">
          <ExternalLink className="size-[18px]" /> View marketplace
        </NavLink>
        <button onClick={() => { logout(); navigate('/') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-700 hover:bg-red-50">
          <LogOut className="size-[18px]" /> Log out
        </button>
        <div className="flex items-center gap-3 px-3 pt-2">
          <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{user?.full_name?.[0]}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user?.full_name}</div>
            <div className="truncate text-xs text-muted">{user?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>

      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lift transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-2 rounded-full p-2 hover:bg-brand-50" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">{title}</span>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {banner}
        <Outlet />
      </main>
    </div>
  )
}
