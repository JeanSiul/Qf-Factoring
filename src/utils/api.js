const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://liissa-unfloatable-seditiously.ngrok-free.dev/webhook'

export const getBaseUrl = () => API_BASE

export const toArray = (res) => {
  if (!res || res === 1 || typeof res === 'number' || typeof res === 'boolean') return []

  if (res && typeof res === 'object' && res.data) {
    const arr = Array.isArray(res.data) ? res.data : [res.data]
    return arr.filter(i => i && typeof i === 'object' && i.id != null)
  }

  if (Array.isArray(res)) {
    return res.filter(i => i && typeof i === 'object' && i.id != null)
  }

  if (typeof res === 'string') {
    const clean = res.trim().startsWith('=') ? res.trim().slice(1) : res.trim()
    try {
      const p = JSON.parse(clean)

      if (p && typeof p === 'object' && p.data) {
        const arr = Array.isArray(p.data) ? p.data : [p.data]
        return arr.filter(i => i && typeof i === 'object' && i.id != null)
      }

      if (Array.isArray(p)) {
        return p.filter(i => i && typeof i === 'object' && i.id != null)
      }

      if (p && typeof p === 'object' && p.id != null) return [p]
    } catch {
      return []
    }
  }

  if (typeof res === 'object' && res.id != null) return [res]

  return []
}

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(err || `Error ${response.status}`)
  }

  const text = await response.text()
  const clean = text.trim().startsWith('=') ? text.trim().slice(1) : text.trim()

  if (!clean || clean === '1' || clean === '0') return null

  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('La API no devolvió JSON válido. Revisa URL de n8n/ngrok.')
  }
}
