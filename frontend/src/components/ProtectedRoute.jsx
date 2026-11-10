import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

export default function ProtectedRoute({ roles }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Spinner className="min-h-[60vh]" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}
