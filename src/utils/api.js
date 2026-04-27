// Cambia esta URL por la URL de tu n8n (ngrok o cloudflare tunnel)
export const N8N_BASE_URL = import.meta.env.VITE_N8N_URL || 'https://export-travelers-hawk-personal.trycloudflare.com'

export const apiCall = async (endpoint, options = {}) => {
  const url = `${N8N_BASE_URL}/webhook${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(err || `Error ${response.status}`)
  }
  return response.json()
}
