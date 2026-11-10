import {
  BadgeCheck, BarChart3, Crown, CircleUser, Boxes, FolderTree, LayoutDashboard, Leaf, Mail, Package, PlusCircle,
  Settings, ShieldCheck, ShoppingBag, Store, UserCog, Users,
} from 'lucide-react'
import { Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import PublicLayout from './layouts/PublicLayout'
import { AdminAdmins, AdminMyAccount } from './pages/admin/AdminAccounts'
import AdminHome from './pages/admin/AdminHome'
import { AdminCategories, AdminProducts } from './pages/admin/AdminCatalog'
import { AdminMessages, AdminOrders } from './pages/admin/AdminOrders'
import { AdminSellers, AdminUsers } from './pages/admin/AdminPeople'
import { AdminGI, AdminOrganic } from './pages/admin/AdminVerification'
import SiteSettings from './pages/admin/SiteSettings'
import Account from './pages/buyer/Account'
import Cart from './pages/buyer/Cart'
import { OrderDetail, Orders } from './pages/buyer/Orders'
import { Login, Register } from './pages/public/Auth'
import Home from './pages/public/Home'
import { About, Contact, NotFound } from './pages/public/Info'
import ProductDetail from './pages/public/ProductDetail'
import SellerStore from './pages/public/SellerStore'
import Shop from './pages/public/Shop'
import Certifications from './pages/seller/Certifications'
import Inventory from './pages/seller/Inventory'
import ProductForm from './pages/seller/ProductForm'
import SellerProducts from './pages/seller/Products'
import Sales from './pages/seller/Sales'
import SellerHome, { SellerStatusBanner } from './pages/seller/SellerHome'
import SellerOrders from './pages/seller/SellerOrders'
import SellerProfile from './pages/seller/SellerProfile'

const SELLER_NAV = [
  { to: '/seller', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/seller/products', label: 'My products', icon: Package, end: true },
  { to: '/seller/products/new', label: 'Add product', icon: PlusCircle },
  { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
  { to: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/seller/certifications', label: 'Certifications & GI', icon: ShieldCheck },
  { to: '/seller/sales', label: 'Sales overview', icon: BarChart3 },
  { to: '/seller/profile', label: 'Profile settings', icon: UserCog },
]

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/sellers', label: 'Sellers', icon: Store },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/gi', label: 'GI documents', icon: BadgeCheck },
  { to: '/admin/organic', label: 'Organic certificates', icon: Leaf },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/messages', label: 'Messages', icon: Mail },
  { to: '/admin/settings', label: 'Site settings', icon: Settings },
  { to: '/admin/admins', label: 'Admins', icon: Crown, ownerOnly: true },
  { to: '/admin/account', label: 'My account', icon: CircleUser },
]

/** Admin dashboard; the Admins page is listed only for the main admin. */
function AdminLayout() {
  const { user } = useAuth()
  return <DashboardLayout title="Admin" nav={ADMIN_NAV.filter((n) => !n.ownerOnly || user?.is_owner)} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/sellers/:id" element={<SellerStore />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cart" element={<Cart />} />
        <Route element={<ProtectedRoute roles={['buyer']} />}>
          <Route path="/account" element={<Account />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute roles={['seller']} />}>
        <Route path="/seller" element={<DashboardLayout title="Seller hub" nav={SELLER_NAV} banner={<SellerStatusBanner />} />}>
          <Route index element={<SellerHome />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="certifications" element={<Certifications />} />
          <Route path="sales" element={<Sales />} />
          <Route path="profile" element={<SellerProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="sellers" element={<AdminSellers />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="gi" element={<AdminGI />} />
          <Route path="organic" element={<AdminOrganic />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="settings" element={<SiteSettings />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="account" element={<AdminMyAccount />} />
        </Route>
      </Route>
    </Routes>
  )
}
