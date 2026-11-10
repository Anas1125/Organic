import axios from 'axios'

const TOKEN_KEY = 'terralens_token'

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (t) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
  },
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.set(null)
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(err)
  },
)

/** Turn any API error into one readable sentence. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0]
    const field = d.loc?.filter((x) => x !== 'body').join(' → ')
    const msg = (d.msg || '').replace(/^Value error, /, '')
    return field ? `${field.replaceAll('_', ' ')}: ${msg}` : msg
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
