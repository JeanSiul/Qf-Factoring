export const getBaseUrl = () => {
  return '/api'
}

// Normaliza cualquier respuesta de n8n a array
export const toArray = (res) => {
  if (!res || res === 1 || typeof res === 'number' || typeof res === 'boolean') return []
  if (Array.isArray(res)) return res.filter(i => i && typeof i === 'object' && i.id != null)
  if (typeof res === 'string') {
    // Limpiar prefijo = que n8n agrega a veces
    const clean = res.startsWith('=') ? res.slice(1) : res
    try {
      const p = JSON.parse(clean)
      if (Array.isArray(p)) return p.filter(i => i && typeof i === 'object' && i.id != null)
      if (p && typeof p === 'object' && p.id != null) return [p]
      return []
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

  // Limpiar prefijo = que n8n agrega en modo expression
  const clean = text.trim().startsWith('=') ? text.trim().slice(1) : text.trim()

  // Si está vacío o es solo un número, devolver null
  if (!clean || clean === '1' || clean === '0') return null

  try {
    return JSON.parse(clean)
  } catch {
    // Si no es JSON válido, devolver null
    return null
  }
}
