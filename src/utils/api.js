export const getBaseUrl = () => {
  return '/api'
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
  // n8n a veces devuelve ="[...]" o =[{...}] con = al inicio
  // Lo limpiamos antes de parsear
  const text = await response.text()
  const clean = text.startsWith('=') ? text.slice(1) : text
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('Respuesta inválida del servidor')
  }
}
