import React from 'react'

const QFLogo = ({ size = 80, showText = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Q circle background */}
      <circle cx="50" cy="50" r="48" fill="white" fillOpacity="0.12"/>
      {/* Q letter */}
      <text x="18" y="72" fontFamily="Montserrat, sans-serif" fontWeight="800" fontSize="68" fill="white">Q</text>
      {/* F letter */}
      <text x="52" y="72" fontFamily="Montserrat, sans-serif" fontWeight="800" fontSize="68" fill="white">F</text>
      {/* Color segments - pie slices at bottom right */}
      <path d="M62 58 L78 68 Q72 80 60 80 Z" fill="#4CAF50" opacity="0.9"/>
      <path d="M78 68 L84 55 Q88 68 78 78 Z" fill="#F5A623" opacity="0.9"/>
      <path d="M62 58 L72 48 L84 55 Z" fill="#E53935" opacity="0.9"/>
    </svg>
    {showText && (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 26, color: 'white', letterSpacing: 1 }}>QF-Factoring</div>
        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.5 }}>Construyendo soluciones financieras simples, seguras y eficientes.</div>
      </div>
    )}
  </div>
)

export default QFLogo
