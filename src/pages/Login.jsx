import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { claveDemo, iniciarSesion, modoDemo, usuariosDemo } from '../lib/db'
import { ROLES } from '../lib/utils'

export default function Login() {
  const { setUsuario } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e, correo = email, pass = clave) => {
    e?.preventDefault()
    setError('')
    if (!correo || !pass) return setError('Ingrese su correo y contraseña.')
    setEnviando(true)
    try {
      setUsuario(await iniciarSesion(correo, pass))
      navegar('/') 
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <section className="login-arte">
        <div className="marca" style={{ padding: 0 }}>
          <div className="marca-logo">SN</div>
          <div><b>Sonrisa Norte</b><span>Clínica dental</span></div>
        </div>
        <div>
          <h1>Agenda, fichas clínicas y pagos en un solo lugar.</h1>
          <p>Sistema de gestión para recepción, dentistas, asistentes, administración y pacientes.</p>
        </div>
        <p className="peq" style={{ opacity: .7 }}>Prototipo académico · Ingeniería de Software</p>
      </section>

      <section className="login-form">
        <div className="login-caja">
          <h2 style={{ fontSize: '1.4rem' }}>Iniciar sesión</h2>
          <p className="suave" style={{ margin: '4px 0 20px' }}>Ingrese con su cuenta de la clínica.</p>
          {error && <div className="alerta error" role="alert">{error}</div>}
          <form onSubmit={entrar} noValidate>
            <div className="campo">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="clave">Contraseña</label>
              <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          <p className="peq suave" style={{ marginTop: 14 }}>
            ¿Es paciente nuevo? <Link to="/registro">Cree su cuenta</Link>
          </p>

          {modoDemo && (
            <div style={{ marginTop: 26 }}>
              <p className="peq"><b>Usuarios de prueba</b> <span className="suave">(contraseña: {claveDemo})</span></p>
              <div className="demo-usuarios">
                {usuariosDemo.slice(0, 6).map((u) => (
                  <button key={u.email} type="button" onClick={() => entrar(null, u.email, claveDemo)}>
                    <b>{ROLES[u.rol]}</b>{u.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
