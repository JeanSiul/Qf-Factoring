import React from 'react'

const POWER_BI_URL =
  'https://app.powerbi.com/reportEmbed?reportId=afaaaaca-3174-40cc-b096-b504eef547b9&autoAuth=true&ctid=9355aa78-a68e-4a0c-8fb3-536b4f040888'

export default function PowerBIGerencia() {
  return (
    <div
      className="fade-in"
      style={{
        padding: 12,
        background: '#071726',
        minHeight: '100vh',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            QF Factoring · Gerencia
          </div>

          <h1
            style={{
              margin: '4px 0',
              color: '#fff',
              fontSize: 28,
              fontWeight: 900,
              fontFamily: 'Montserrat',
            }}
          >
            Power BI Ejecutivo
          </h1>

          <p
            style={{
              margin: 0,
              color: '#9fb7cc',
              fontSize: 13,
            }}
          >
            Dashboard corporativo conectado a MySQL en tiempo real.
          </p>
        </div>

        <a
          href={POWER_BI_URL}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
          style={{
            textDecoration: 'none',
          }}
        >
          Abrir en Power BI
        </a>
      </div>

      {/* CONTENEDOR POWER BI */}
      <div
        style={{
          background: '#0b1f33',
          borderRadius: 18,
          padding: 10,
          border: '1px solid #17324a',
          boxShadow: '0 10px 25px rgba(0,0,0,.25)',
          height: 'calc(100vh - 120px)',
          overflow: 'hidden',
        }}
      >
        <iframe
          title="QF Power BI"
          src={POWER_BI_URL}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          style={{
            border: 0,
            borderRadius: 12,
            background: '#fff',
          }}
        />
      </div>
    </div>
  )
}

function Kpi({ title, value, subtitle, color }) {
  return (
    <div
      style={{
        background: '#0d2234',
        borderRadius: 14,
        padding: '14px 16px',
        border: '1px solid #17324a',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#7fa4bf',
          textTransform: 'uppercase',
          fontWeight: 800,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize: 26,
          fontWeight: 900,
          fontFamily: 'Montserrat',
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 6,
          color: '#9fb7cc',
          fontSize: 11,
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}
