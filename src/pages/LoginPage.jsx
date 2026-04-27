import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiCall } from '../utils/api'
import QFLogo from '../components/QFLogo'

const LoginPage = () => {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!usuario || !password) { setError('Complete todos los campos'); return }
    setLoading(true)
    setError('')
    try {
      const res = await apiCall('/qf/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario: usuario.trim().toUpperCase(), password })
      })
      if (res.success) {
        login(res.user)
        navigate('/dashboard')
      } else {
        setError(res.message || 'Usuario o contraseña incorrectos')
      }
    } catch (err) {
      setError('Error de conexión. Verifique su conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.leftContent}>
          <QFLogo size={90} showText={true} />
          <div style={styles.leftDeco}>
            <div style={styles.decoLine1}/>
            <div style={styles.decoLine2}/>
            <div style={styles.decoLine3}/>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Iniciar Sesión</h2>
            <p style={styles.formSubtitle}>Ingrese sus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input
                className="form-control"
                type="text"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={styles.eyeBtn}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8, justifyContent: 'center' }}
            >
              {loading ? <><span className="spinner"/> Verificando...</> : 'Ingresar'}
            </button>

            <div style={styles.forgotLink}>
              <a href="#" style={styles.link} onClick={e => e.preventDefault()}>¿Olvidó su contraseña?</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    background: 'white',
  },
  left: {
    flex: 1,
    background: 'linear-gradient(145deg, #1A2E4A 0%, #243d62 60%, #1a3a5c 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 300,
  },
  leftContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    zIndex: 2,
    padding: 32,
  },
  leftDeco: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    zIndex: 1,
  },
  decoLine1: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  decoLine2: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  decoLine3: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 4,
    height: 80,
    background: 'linear-gradient(to bottom, #4CAF50, #F5A623, #E53935)',
    borderRadius: 2,
  },
  right: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    background: 'white',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    animation: 'fadeIn 0.4s ease',
  },
  formHeader: {
    marginBottom: 32,
  },
  formTitle: {
    fontFamily: 'Montserrat',
    fontWeight: 700,
    fontSize: 28,
    color: '#1A2E4A',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6b7a8d',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    color: '#6b7a8d',
  },
  errorBox: {
    background: '#fce4e4',
    color: '#c62828',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #ffcdd2',
  },
  forgotLink: {
    textAlign: 'center',
    marginTop: 16,
  },
  link: {
    color: '#2D6A9F',
    fontSize: 13,
    textDecoration: 'none',
  },
}

export default LoginPage
