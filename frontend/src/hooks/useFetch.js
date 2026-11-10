import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client'

/** GET a URL and track loading / error. Pass null to skip. */
export default function useFetch(url, params) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState(null)
  const key = url + JSON.stringify(params || {})

  const load = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(url, { params })
      setData(res.data)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { load() }, [load])

  return { data, setData, loading, error, reload: load }
}
