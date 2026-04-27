export const N8N_BASE_URL = window.__N8N_URL__ || 'https://lissa-unfloatable-seditiously.ngrok-free.dev'

export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = window.__N8N_URL__ || N8N_BASE_URL
  const url = `${baseUrl}/webhook${endpoint}`
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
