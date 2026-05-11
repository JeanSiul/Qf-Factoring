import React, { useMemo, useState } from 'react'
import './GerenciaPowerBI.css'

const POWER_BI_SERVICE_URL = 'https://app.powerbi.com/groups/me/reports/afaaaaca-3174-40cc-b096-b504eef547b9/6f6dd46177c235169452?ctid=9355aa78-a68e-4a0c-8fb3-536b4f040888&experience=power-bi'

// IMPORTANTE:
// Un archivo .pbix NO se puede renderizar directamente en un navegador.
// Para verlo embebido y con datos en tiempo real debe estar publicado en Power BI Service.
// Si deseas dejar el PBIX disponible para descarga, ponlo en:
// public/powerbi/REPORTE-GERENCIAS.pbix
const PBIX_DOWNLOAD_URL = '/powerbi/REPORTE-GERENCIAS.pbix'

const reports = [
  {
    id: 'qf-gerencias',
    title: 'Reporte Gerencias',
    description: 'Power BI Service conectado al dataset corporativo.',
    url: POWER_BI_SERVICE_URL,
  },
]

export default function PowerBIGerencias() {
  const [selected, setSelected] = useState(reports[0])
  const [showHelp, setShowHelp] = useState(true)

  const embedUrl = useMemo(() => selected.url, [selected])

  return (
    <div className="qf-pbi-page fade-in">
      <header className="qf-pbi-hero">
        <div>
          <div className="qf-pbi-eyebrow">QF Factoring · Gerencia</div>
          <h1>Power BI Embebido</h1>
          <p>Centro para visualizar reportes publicados en Power BI Service desde el sistema.</p>
        </div>

        <div className="qf-pbi-actions">
          <select
            className="filter-input"
            value={selected.id}
            onChange={e => setSelected(reports.find(r => r.id === e.target.value) || reports[0])}
          >
            {reports.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>

          <a className="btn btn-primary btn-sm" href={selected.url} target="_blank" rel="noreferrer">
            Abrir en Power BI
          </a>

          <a className="btn btn-secondary btn-sm" href={PBIX_DOWNLOAD_URL} download>
            Descargar PBIX
          </a>
        </div>
      </header>

      <section className="qf-pbi-kpis">
        <Info title="Modo" value="Power BI" hint="Service / iframe" color="#185FA5" />
        <Info title="Datos" value="Tiempo real" hint="Según gateway/dataset" color="#2E7D32" />
        <Info title="Archivo PBIX" value="Descarga" hint="No se renderiza directo" color="#F57C00" />
        <Info title="Acceso" value="Microsoft" hint="Puede pedir login" color="#7E57C2" />
      </section>

      {showHelp && (
        <div className="qf-pbi-note">
          <button onClick={() => setShowHelp(false)}>x</button>
          <b>Nota técnica:</b> el navegador no puede abrir un <code>.pbix</code> como dashboard interactivo.
          Para mantener conexiones MySQL y actualización real, el reporte debe estar publicado en Power BI Service
          usando gateway/dataset. Esta página embebe el reporte publicado y deja el PBIX como descarga opcional.
        </div>
      )}

      <section className="page-card qf-pbi-card">
        <div className="qf-pbi-card-head">
          <div>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
          </div>
          <span>Power BI</span>
        </div>

        <div className="qf-pbi-frame">
          <iframe
            title={selected.title}
            src={embedUrl}
            width="100%"
            height="100%"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  )
}

function Info({ title, value, hint, color }) {
  return (
    <div className="qf-pbi-info" style={{ borderTopColor: color }}>
      <span>{title}</span>
      <b style={{ color }}>{value}</b>
      <small>{hint}</small>
    </div>
  )
}
