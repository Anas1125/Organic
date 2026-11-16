import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api, { tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setReady(true)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [refresh])

  const finish = (data, remember = true) => {
    tokenStore.set(data.access_token, remember)
    setUser(data.user)
    return data.user
  }

  const login = async (email, password, remember = false) =>
    finish((await api.post('/auth/login', { email, password, remember })).data, remember)
  const register = async (body) => finish((await api.post('/auth/register', body)).data)
  const logout = () => {
    tokenStore.set(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, ready, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const homeFor = (user) =>
  ({ admin: '/admin', seller: '/seller', buyer: '/' })[user?.role] || '/'
