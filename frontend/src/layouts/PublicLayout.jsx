import { Home, LayoutGrid, LogOut, Package, Search, ShoppingCart, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Brand'
import ContactDetails, { contactItems } from '../components/ContactDetails'
import SearchBar from '../components/SearchBar'
import { homeFor, useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useSite } from '../context/SiteContext'

function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link to="/login" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold hover:bg-brand-50">Log in</Link>
        <Link to="/register" className="hidden whitespace-nowrap rounded-full bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 sm:block">Sign up</Link>
      </div>
    )
  }
  const items = {
    buyer: [['/orders', 'My orders'], ['/account', 'Profile']],
    seller: [['/seller', 'Seller dashboard'], ['/seller/orders', 'Orders'], ['/seller/profile', 'Profile']],
    admin: [['/admin', 'Admin dashboard']],
  }[user.role]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-brand-50" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
          {user.full_name[0]?.toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-medium md:block">{user.full_name.split(' ')[0]}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl bg-white py-1.5 shadow-lift">
          <div className="border-b border-line px-4 pb-2.5 pt-1.5">
            <div className="truncate text-sm font-semibold">{user.full_name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
          {items.map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-brand-50" role="menuitem">{label}</Link>
          ))}
          <button
            onClick={() => { logout(); navigate('/') }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            role="menuitem"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

function Navbar() {
  const { user } = useAuth()
  const { count } = useCart()
  const [showSearch, setShowSearch] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setShowSearch(false) }, [pathname])

  const link = ({ isActive }) => `rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-ink/80 hover:text-brand-800'}`

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          <NavLink to="/shop" className={link}>Shop</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
          <NavLink to="/contact" className={link}>Contact</NavLink>
          {user?.role === 'seller' && <NavLink to="/seller" className={link}>Seller hub</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>
        <SearchBar className="mx-auto hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button onClick={() => setShowSearch(!showSearch)} className="grid size-10 place-items-center rounded-full hover:bg-brand-50 md:hidden" aria-label="Search">
            <Search className="size-5" />
          </button>
          {(!user || user.role === 'buyer') && (
            <Link to="/cart" className="relative grid size-10 place-items-center rounded-full hover:bg-brand-50" aria-label={`Cart, ${count} items`}>
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">{count}</span>
              )}
            </Link>
          )}
          <AccountMenu />
        </div>
      </div>
      {showSearch && <div className="container-page pb-3 md:hidden"><SearchBar autoFocus /></div>}
    </header>
  )
}

function MobileTabBar() {
  const { user } = useAuth()
  const { count } = useCart()
  const accountTo = user ? (user.role === 'buyer' ? '/account' : homeFor(user)) : '/login'
  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/shop', label: 'Shop', icon: LayoutGrid },
    user?.role === 'seller' || user?.role === 'admin'
      ? { to: homeFor(user), label: 'Dashboard', icon: Package }
      : { to: '/cart', label: 'Cart', icon: ShoppingCart, badge: count },
    { to: accountTo, label: user ? 'Account' : 'Log in', icon: User },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      <div className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink key={label} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-800' : 'text-muted'}`}>
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
                  {badge > 0 && <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">{badge}</span>}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Footer() {
  const { site } = useSite()
  const hasContact = contactItems(site).length > 0
  return (
    <footer className="mt-16 bg-brand-900 pb-24 text-brand-100 md:pb-0">
      <div className={`container-page grid gap-10 py-12 sm:grid-cols-2 ${hasContact ? 'lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]' : 'lg:grid-cols-4'}`}>
        <div className={hasContact ? 'sm:col-span-2 lg:col-span-1' : 'sm:col-span-2'}>
          <Logo light />
          {site.tagline && <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200/80">{site.tagline}</p>}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Marketplace</h3>
          <ul className="space-y-2 text-sm text-brand-200/80">
            <li><Link to="/shop" className="hover:text-white">All products</Link></li>
            <li><Link to="/shop?organic=true" className="hover:text-white">Certified organic</Link></li>
            <li><Link to="/shop?gi=true" className="hover:text-white">GI-tagged foods</Link></li>
            <li><Link to="/shop?bulk=true" className="hover:text-white">Bulk deals</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Company</h3>
          <ul className="space-y-2 text-sm text-brand-200/80">
            <li><Link to="/about" className="hover:text-white">About us</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link to="/register?role=seller" className="hover:text-white">Sell on {site.site_name}</Link></li>
          </ul>
        </div>
        {hasContact && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Contact</h3>
            <ContactDetails variant="footer" />
          </div>
        )}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page py-5 text-xs text-brand-200/60">© {new Date().getFullYear()} {site.site_name}. Real food, real impact.</div>
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  )
}
