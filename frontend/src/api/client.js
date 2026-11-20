import axios from 'axios'

const TOKEN_KEY = 'terralens_token'

// "Remember me" keeps the login in localStorage (survives closing the browser);
// otherwise it lives in sessionStorage and ends with the browser session.
export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (t, remember = true) => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t)
    } catch { /* private mode */ }
  },
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.set(null)
      window.dispatchEvent(new Event('auth:expired'))
    }
    // Page loads (GET) that get no answer or a "server busy" answer are retried twice:
    // the host sometimes drops the first request while a sleeping server wakes up.
    // Only GETs: repeating a POST could place an order or payment twice.
    const cfg = err.config
    const transient = !err.response || [502, 503, 504].includes(err.response.status)
    if (cfg && (cfg.method || 'get') === 'get' && transient && navigator.onLine !== false && (cfg.__retries || 0) < 2) {
      cfg.__retries = (cfg.__retries || 0) + 1
      await wait(600 * cfg.__retries)
      return api(cfg)
    }
    return Promise.reject(err)
  },
)

const FIELD_LABELS = {
  phone: 'Mobile number', shipping_phone: 'Phone', email: 'Email', full_name: 'Full name', password: 'Password',
  new_password: 'New password', business_name: 'Business name', shipping_pincode: 'PIN code', pincode: 'PIN code',
  payout_upi: 'UPI ID', payment_upi: 'UPI ID', bank_ifsc: 'IFSC', bank_account_number: 'Account number',
  commission_percent: 'Commission', reference: 'Reference',
}

/** Turn any API error into one readable sentence. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  // No response at all: offline, the server busy, or the host refused an upload that's
  // too large (the browser reports that as a "CORS" error).
  if (err?.isAxiosError && !err.response) {
    if (navigator.onLine === false) return 'You seem to be offline. Check your connection and try again.'
    return err.config?.data instanceof FormData
      ? 'The upload didn’t go through. The file may be too large (max about 4 MB) — try a smaller one.'
      : 'Couldn’t reach the server just now. Please try again in a moment.'
  }
  if (err?.response?.status === 413) return 'That file is too large to upload. Please use one under 4 MB.'
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0]
    const key = d.loc?.filter((x) => x !== 'body').at(-1)
    const msg = (d.msg || '').replace(/^Value error, /, '')
    if (!key || typeof key !== 'string' || /^Enter |^For a /.test(msg)) return msg  // already a full sentence
    const label = FIELD_LABELS[key] || key.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
    return `${label}: ${msg}`
  }
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is the API running?'
  return fallback
}

/** Open a private document (needs the auth header, so we fetch it as a blob). */
export async function openDocument(path) {
  const win = window.open('', '_blank')
  try {
    const res = await api.get(path, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    if (win) win.location.href = url
    else window.location.href = url
  } catch (e) {
    win?.close()
    throw e
  }
}

export default api
