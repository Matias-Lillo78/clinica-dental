import { filtroNotificaciones, useAuth } from '../App'
import { Cargando, Encabezado, useDatos } from '../components/ui'
import { actualizar, listar } from '../lib/db'
import { fechaHora } from '../lib/utils'

const TIPOS = {
  llegada: { icono: '🚶', color: 'var(--acento-claro)', texto: 'Llegada de paciente' },
  cambio: { icono: '🔁', color: 'var(--info-claro)', texto: 'Cambio de cita' },
  recordatorio: { icono: '⏰', color: 'var(--aviso-claro)', texto: 'Recordatorio' },
  cancelacion: { icono: '✖', color: 'var(--error-claro)', texto: 'Cancelación' },
  solicitud: { icono: '📩', color: 'var(--primario-claro)', texto: 'Solicitud de cita' },
  confirmacion: { icono: '✔', color: 'var(--ok-claro)', texto: 'Cita agendada' },
}

// CU-03, CU-04 y CU-15: avisos de cambios, recordatorios y llegadas
export default function Notificaciones() {
  const { usuario } = useAuth()
  const [lista, recargar] = useDatos(
    () => listar('notificaciones', { filtros: filtroNotificaciones(usuario), orden: 'creado_en', asc: false }),
    [usuario],
  )

  const marcarLeidas = async () => {
    for (const n of lista.filter((x) => x.estado !== 'leida')) await actualizar('notificaciones', n.id, { estado: 'leida' })
    window.dispatchEvent(new Event('notificaciones'))
    recargar()
  }
  const reintentar = async (n) => {
    await actualizar('notificaciones', n.id, { estado: 'enviada', creado_en: new Date().toISOString() })
    recargar()
  }

  if (!lista) return <Cargando />
  const sinLeer = lista.filter((n) => n.estado !== 'leida').length

  return (
    <>
      <Encabezado titulo="Notificaciones" sub={`${sinLeer} sin leer · ${lista.length} en total`}>
        {sinLeer > 0 && <button className="btn sec" onClick={marcarLeidas}>Marcar todas como leídas</button>}
      </Encabezado>
      <div className="tarjeta">
        {lista.length === 0 && <p className="vacio">No tiene notificaciones.</p>}
        {lista.map((n) => {
          const t = TIPOS[n.tipo] || TIPOS.cambio
          return (
            <div key={n.id} className={`notif ${n.estado !== 'leida' ? 'nueva' : ''}`}>
              <div className="notif-icono" style={{ background: t.color }} aria-hidden="true">{t.icono}</div>
              <div style={{ flex: 1 }}>
                <p>{n.mensaje}</p>
                <span className="suave peq">{t.texto} · {fechaHora(n.creado_en)}</span>
              </div>
              {n.estado === 'error' && <button className="btn mini sec" onClick={() => reintentar(n)}>Reintentar envío</button>}
              {n.estado !== 'leida' && n.estado !== 'error' && <span className="chip e-presente" style={{ alignSelf: 'center' }}>Nueva</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}
