import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { cerrarSesion, listar, modoDemo, reiniciarDemo, sesionGuardada } from './lib/db'
import { ROLES } from './lib/utils'

import Login from './pages/Login'
import RegistroPaciente from './pages/RegistroPaciente'
import MisCitas from './pages/paciente/MisCitas'
import SolicitarCita from './pages/paciente/SolicitarCita'
import Agenda from './pages/recepcion/Agenda'
import Disponibilidad from './pages/recepcion/Disponibilidad'
import NuevaCita from './pages/recepcion/NuevaCita'
import Pacientes from './pages/recepcion/Pacientes'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Menú y permisos de cada rol (RNF-01: cada usuario ve solo lo de su cargo).
// Cada opción indica su ruta, los roles que pueden verla y la pantalla que muestra.
// La primera opción de cada rol es su pantalla de inicio.
const MENU = [
  { ruta: '/mis-citas', texto: 'Mis citas', icono: '📅', roles: ['paciente'], Pagina: MisCitas },
  { ruta: '/solicitar', texto: 'Solicitar cita', icono: '➕', roles: ['paciente'], Pagina: SolicitarCita },
  { ruta: '/agenda', texto: 'Agenda del día', icono: '📅', roles: ['recepcionista', 'asistente', 'admin'], Pagina: Agenda },
  { ruta: '/disponibilidad', texto: 'Disponibilidad', icono: '🕒', roles: ['recepcionista', 'admin'], Pagina: Disponibilidad },
  { ruta: '/nueva-cita', texto: 'Registrar cita', icono: '➕', roles: ['recepcionista', 'admin'], Pagina: NuevaCita },
  { ruta: '/pacientes', texto: 'Pacientes', icono: '👥', roles: ['recepcionista', 'admin'], Pagina: Pacientes },
]

// Qué notificaciones le corresponden a cada rol
export function filtroNotificaciones(u) {
  if (u.rol === 'paciente') return { para_rol: 'paciente', paciente_id: u.paciente_id }
  if (u.rol === 'dentista') return { para_rol: 'dentista', dentista_id: u.dentista_id }
  if (u.rol === 'asistente') return { para_rol: 'dentista' }
  if (u.rol === 'recepcionista') return { para_rol: 'recepcion' }
  return {}
}

export default function App() {
  const [usuario, setUsuario] = useState(undefined)

  useEffect(() => {
    sesionGuardada().then(setUsuario).catch(() => setUsuario(null))
  }, [])

  if (usuario === undefined) return null

  const salir = async () => { await cerrarSesion(); setUsuario(null) }
  const inicio = usuario && MENU.find((m) => m.roles.includes(usuario.rol))?.ruta

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, salir }}>
      {!usuario ? (
        <Routes>
          <Route path="/registro" element={<RegistroPaciente />} />
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={inicio ? <Navigate to={inicio} replace /> : <Bienvenida />} />
            {MENU.map(({ ruta, Pagina }) => (
              <Route key={ruta} path={ruta} element={<Protegida ruta={ruta}><Pagina /></Protegida>} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </AuthContext.Provider>
  )
}

// Pantalla que se muestra si el rol todavía no tiene módulos disponibles
function Bienvenida() {
  const { usuario } = useAuth()
  return (
    <div className="tarjeta" style={{ maxWidth: 520 }}>
      <h2>Bienvenido/a, {usuario.nombre}</h2>
      <p className="suave" style={{ marginTop: 8 }}>Los módulos de su perfil ({ROLES[usuario.rol]}) estarán disponibles pronto.</p>
    </div>
  )
}

// Bloquea pantallas que no corresponden al rol del usuario
function Protegida({ ruta, children }) {
  const { usuario } = useAuth()
  const item = MENU.find((m) => m.ruta === ruta)
  if (!item.roles.includes(usuario.rol)) {
    return (
      <div className="tarjeta" style={{ maxWidth: 520 }}>
        <h2>Acceso restringido</h2>
        <p className="suave" style={{ marginTop: 8 }}>
          Su perfil ({ROLES[usuario.rol]}) no tiene permiso para ver esta sección.
        </p>
      </div>
    )
  }
  return children
}

function Layout({ children }) {
  const { usuario, salir } = useAuth()
  const navegar = useNavigate()
  const [sinLeer, setSinLeer] = useState(0)
  const [aviso, setAviso] = useState(null)
  const vistos = useRef(null)

  // Revisa notificaciones nuevas cada 10 segundos
  useEffect(() => {
    let activo = true
    const revisar = async () => {
      let lista = []
      try { lista = await listar('notificaciones', { filtros: filtroNotificaciones(usuario) }) } catch { return }
      if (!activo) return
      setSinLeer(lista.filter((n) => n.estado !== 'leida').length)
      const ids = new Set(lista.map((n) => n.id))
      if (vistos.current) {
        const nueva = lista.find((n) => !vistos.current.has(n.id))
        if (nueva) { setAviso(nueva.mensaje); setTimeout(() => setAviso(null), 6000) }
      }
      vistos.current = ids
    }
    revisar()
    const t = setInterval(revisar, 10000)
    window.addEventListener('notificaciones', revisar)
    return () => { activo = false; clearInterval(t); window.removeEventListener('notificaciones', revisar) }
  }, [usuario])

  const opciones = MENU.filter((m) => m.roles.includes(usuario.rol))

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <div className="marca-logo">SN</div>
          <div><b>Sonrisa Norte</b><span>Clínica dental</span></div>
        </div>
        <nav style={{ display: 'contents' }} aria-label="Menú principal">
          {opciones.map((m) => (
            <NavLink key={m.ruta} to={m.ruta} className="nav-link">
              <span aria-hidden="true">{m.icono}</span> {m.texto}
              {m.ruta === '/notificaciones' && sinLeer > 0 && <span className="cont">{sinLeer}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-pie">
          <b>{usuario.nombre}</b>
          <span style={{ opacity: .75 }}>{ROLES[usuario.rol]}</span>
        </div>
      </aside>
      <div className="principal">
        {modoDemo && (
          <div className="banda-demo">
            Modo demostración: datos de ejemplo sin conexión a Supabase.{' '}
            <button className="btn mini sec" style={{ padding: '1px 8px', marginLeft: 6 }} onClick={() => { reiniciarDemo(); navegar(0) }}>Reiniciar datos</button>
          </div>
        )}
        <header className="barra">
          <span className="suave peq">{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <div className="fila">
            <span className="chip e-en_atencion">{ROLES[usuario.rol]}</span>
            <button className="btn sec mini" onClick={salir}>Cerrar sesión</button>
          </div>
        </header>
        <main className="contenido">{children}</main>
      </div>
      {aviso && <div className="aviso-flotante" role="alert">🔔 {aviso}</div>}
    </div>
  )
}
