import React, { useEffect, useRef, useState } from 'react'

const EMBED_TOKEN_ENDPOINT = '/api/powerbi/embed-token'
const POWERBI_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/powerbi-client/2.23.7/powerbi.min.js'

export default function PowerBIEmbeddedGerencia() {
  const containerRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadScript = () =>
      new Promise((resolve, reject) => {
        if (window.powerbi) return resolve()

        const script = document.createElement('script')
        script.src = POWERBI_CDN
        script.async = true
        script.onload = resolve
        script.onerror = () => reject(new Error('No se pudo cargar powerbi-client desde CDN'))
        document.body.appendChild(script)
      })

    const init = async () => {
      try {
        setLoading(true)
        setError('')

        await loadScript()

        const res = await fetch(EMBED_TOKEN_ENDPOINT)
        const text = await res.text()

        let data
        
        try {
          data = JSON.parse(text)
        } catch (e) {
          throw new Error(text)
        }

        if (!res.ok) {
          throw new Error(
            data?.message ||
            data?.detail ||
            'No se pudo obtener embed token'
          )
        }

        const models = window['powerbi-client'].models

        const config = {
          type: 'report',
          id: data.reportId,
          embedUrl: data.embedUrl,
          accessToken: data.embedToken,
          tokenType: models.TokenType.Embed,
          permissions: models.Permissions.All,
          settings: {
            panes: {
              filters: { visible: true, expanded: false },
              pageNavigation: { visible: true },
            },
            background: models.BackgroundType.Transparent,
          },
        }

        window.powerbi.reset(containerRef.current)
        window.powerbi.embed(containerRef.current, config)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  return (
    <div style={{ height: '100vh', background: '#071726', padding: 10 }}>
      {loading && <div style={{ color: '#fff' }}>Cargando Power BI Embedded...</div>}
      {error && <div style={{ color: '#fecaca', padding: 12 }}>{error}</div>}

      <div
        ref={containerRef}
        style={{
          height: 'calc(100vh - 20px)',
          background: '#fff',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
