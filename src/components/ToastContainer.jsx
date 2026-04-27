import React from 'react'

const ToastContainer = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
    {toasts.map(t => (
      <div key={t.id} className={`toast ${t.type}`}>
        {t.type === 'success' && '✓ '}
        {t.type === 'error' && '✕ '}
        {t.type === 'warning' && '⚠ '}
        {t.message}
      </div>
    ))}
  </div>
)

export default ToastContainer
