const API_BASE =
  import.meta.env.VITE_API_URL || 'https://liissa-unfloatable-seditiously.ngrok-free.dev/webhook'

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...options.headers
    }
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
