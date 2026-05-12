import React, { useEffect, useMemo, useState } from 'react'
import { PowerBIEmbed } from 'powerbi-client-react'
import { models } from 'powerbi-client'

const EMBED_TOKEN_ENDPOINT = '/api/powerbi/embed-token'

export default function PowerBIEmbeddedGerencia() {
  const [embedData, setEmbedData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargarToken = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(EMBED_TOKEN_ENDPOINT, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Error ${res.status}`)
      }

      const data = await res.json()

      if (!data?.embedToken && !data?.accessToken) {
        throw new Error('El backend no devolvio embedToken/accessToken')
      }

      if (!data?.embedUrl) {
        throw new Error('El backend no devolvio embedUrl')
      }

      if (!data?.reportId) {
        throw new Error('El backend no devolvio reportId')
      }

      setEmbedData({
        reportId: data.reportId,
        embedUrl: data.embedUrl,
        accessToken: data.embedToken || data.accessToken,
        expires: data.expires,
      })
    } catch (e) {
      setError(e.message || 'No se pudo cargar Power BI Embedded')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarToken()
  }, [])

  const embedConfig = useMemo(() => {
    if (!embedData) return null

    return {
      type: 'report',
      id: embedData.reportId,
      embedUrl: embedData.embedUrl,
      accessToken: embedData.accessToken,
      tokenType: models.TokenType.Embed,
      permissions: models.Permissions.All,
      settings: {
        background: models.BackgroundType.Transparent,
        panes: {
          filters: { visible: true, expanded: false },
          pageNavigation: { visible: true },
        },
        bars: {
          statusBar: { visible: true },
        },
      },
    }
  }, [embedData])

  return (
    <div className="fade-in" style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.eyebrow}>QF Factoring · Gerencia</div>
          <h1 style={S.title}>Power BI Embedded</h1>
          <p style={S.subtitle}>Acceso transparente con token seguro generado por el backend.</p>
        </div>

        <div style={S.actions}>
          {embedData?.expires && (
            <span style={S.expire}>
              Expira: {new Date(embedData.expires).toLocaleString('es-PE')}
            </span>
          )}

          <button className="btn btn-secondary btn-sm" onClick={cargarToken} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar token'}
          </button>
        </div>
      </div>

      {error && (
        <div style={S.errorBox}>
          <b>No se pudo cargar Power BI Embedded.</b>
          <span>{error}</span>
          <small>
            Esta pagina requiere que exista el endpoint backend <code>/api/powerbi/embed-token</code>
            y que devuelva reportId, embedUrl y embedToken.
          </small>
        </div>
      )}

      {loading && !embedConfig && (
        <div style={S.loading}>
          <span className="spinner dark" /> Cargando token Power BI...
        </div>
      )}

      {!loading && embedConfig && (
        <div style={S.powerbiShell}>
          <PowerBIEmbed
            embedConfig={embedConfig}
            cssClassName="qf-powerbi-embedded-frame"
            eventHandlers={
              new Map([
                ['loaded', () => console.log('Power BI report loaded')],
                ['rendered', () => console.log('Power BI report rendered')],
                ['error', event => {
                  console.error('Power BI error:', event?.detail)
                  setError(event?.detail?.message || 'Error renderizando Power BI')
                }],
              ])
            }
          />
        </div>
      )}

      <style>{`
        .qf-powerbi-embedded-frame {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .qf-powerbi-embedded-frame iframe {
          border: 0 !important;
          border-radius: 12px;
        }
      `}</style>
    </div>
  )
}

const S = {
  page: {
    padding: 12,
    background: '#071726',
    minHeight: '100vh',
    color: '#fff',
  },
  header: {
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    margin: '4px 0',
    color: '#fff',
    fontSize: 26,
    fontWeight: 900,
    fontFamily: 'Montserrat',
  },
  subtitle: {
    margin: 0,
    color: '#9fb7cc',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expire: {
    fontSize: 11,
    color: '#9fb7cc',
    background: '#0d2234',
    border: '1px solid #17324a',
    borderRadius: 999,
    padding: '6px 10px',
  },
  powerbiShell: {
    height: 'calc(100vh - 105px)',
    overflow: 'hidden',
    borderRadius: 16,
    border: '1px solid #17324a',
    background: '#fff',
    boxShadow: '0 10px 25px rgba(0,0,0,.25)',
  },
  loading: {
    height: 'calc(100vh - 130px)',
    display: 'grid',
    placeItems: 'center',
    background: '#0d2234',
    border: '1px solid #17324a',
    borderRadius: 16,
    color: '#d7efff',
    fontSize: 14,
  },
  errorBox: {
    marginBottom: 10,
    background: '#3b1111',
    border: '1px solid #ef4444',
    color: '#fecaca',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 4,
    fontSize: 13,
  },
}
