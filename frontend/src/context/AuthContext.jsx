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

  // Login / sign-up either log straight in, or return { otp: {...} } when an emailed
  // code is needed first — the page then shows the code screen and calls verifyOtp.
  const deviceKey = 'terralens_device'
  const deviceToken = () => { try { return localStorage.getItem(deviceKey) } catch { return null } }
  const settle = (data, remember) => (data.otp_required ? { otp: { trust: remember, ...data, remember } } : { user: finish(data, remember) })
  const login = async (email, password, remember = false) =>
    settle((await api.post('/auth/login', { email, password, remember, device_token: deviceToken() })).data, remember)
  // After sign-up the browser stays logged in, but isn't trusted: the next login asks for a code.
  const register = async (body) => settle({ ...(await api.post('/auth/register', body)).data, trust: false }, true)
  // remember: keep this login after the browser closes. trust: skip the code on this
  // browser for 30 days (only when the customer ticked "Remember me" at login).
  const verifyOtp = async (challenge, code, remember, trust = remember) => {
    const { data } = await api.post('/auth/verify-otp', { challenge, code, remember: trust })
    if (data.device_token) { try { localStorage.setItem(deviceKey, data.device_token) } catch { /* private mode */ } }
    return finish(data, remember)
  }
  const resendOtp = async (challenge) => (await api.post('/auth/resend-otp', { challenge })).data
  const logout = () => {
    tokenStore.set(null)
    // Logging out also forgets this browser, so the next login asks for an emailed code.
    try { localStorage.removeItem(deviceKey) } catch { /* private mode */ }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, ready, login, register, verifyOtp, resendOtp, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const homeFor = (user) =>
  ({ admin: '/admin', seller: '/seller', buyer: '/' })[user?.role] || '/'
