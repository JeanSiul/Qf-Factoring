export const getBaseUrl = () => {
  return '/api'
}

// Normaliza cualquier respuesta de n8n a array
export const toArray = (res) => {
  if (!res || res === 1 || typeof res === 'number' || typeof res === 'boolean') return []

  // n8n a veces devuelve { data: [...] }
  if (res && typeof res === 'object' && res.data) {
    const arr = Array.isArray(res.data) ? res.data : [res.data]
    return arr.filter(i => i && typeof i === 'object' && i.id != null)
  }

  if (Array.isArray(res)) return res.filter(i => i && typeof i === 'object' && i.id != null)

  if (typeof res === 'string') {
    const clean = res.trim().startsWith('=') ? res.trim().slice(1) : res.trim()
    try {
      const p = JSON.parse(clean)
      if (p && typeof p === 'object' && p.data) {
        const arr = Array.isArray(p.data) ? p.data : [p.data]
        return arr.filter(i => i && typeof i === 'object' && i.id != null)
      }
      if (Array.isArray(p)) return p.filter(i => i && typeof i === 'object' && i.id != null)
      if (p && typeof p === 'object' && p.id != null) return [p]
    } catch { return [] }
  }

  if (typeof res === 'object' && res.id != null) return [res]
  return []
}

export const apiCall = async (endpoint, options = {}) => {
  const url = `/api/webhook${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      ...options.headers
    },
    ...options
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
    return null
  }
}
