import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../App'
import { Cargando, Encabezado, Estado, Mensaje, Modal, useDatos } from '../../components/ui'
import { actualizar, listar, notificar } from '../../lib/db'
import { fechaCorta, fechaLarga, hoy } from '../../lib/utils'

// CU-02: el paciente revisa y cancela sus citas
export default function MisCitas() {
  const { usuario } = useAuth()
  const [datos, recargar] = useDatos(async () => {
    const [citas, dentistas, boxes] = await Promise.all([
      listar('citas', { filtros: { paciente_id: usuario.paciente_id }, orden: 'fecha' }),
      listar('dentistas'), listar('boxes'),
    ])
    return { citas, dentistas, boxes }
  }, [usuario])
  const [aCancelar, setACancelar] = useState(null)
  const [msg, setMsg] = useState(null)

  if (!datos) return <Cargando />
  const den = (id) => datos.dentistas.find((d) => d.id === id)
  const box = (id) => datos.boxes.find((b) => b.id === id)?.nombre
  const activas = ['pendiente', 'confirmada']
  const proximas = datos.citas.filter((c) => c.fecha >= hoy() && activas.includes(c.estado))
  const pasadas = datos.citas.filter((c) => !proximas.includes(c)).reverse()

  const cancelar = async () => {
    const c = aCancelar
    await actualizar('citas', c.id, { estado: 'cancelada' }, 'Cancelada por el paciente')
    const texto = `${usuario.nombre} canceló su cita del ${fechaCorta(c.fecha)} a las ${c.hora}.`
    await notificar({ para_rol: 'recepcion', paciente_id: usuario.paciente_id, cita_id: c.id, tipo: 'cancelacion', mensaje: texto })
    await notificar({ para_rol: 'dentista', dentista_id: c.dentista_id, paciente_id: usuario.paciente_id, cita_id: c.id, tipo: 'cancelacion', mensaje: texto })
    setACancelar(null)
    setMsg({ tipo: 'ok', texto: 'Su cita fue cancelada correctamente. La clínica fue notificada.' })
    recargar()
  }

  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(' ')[0]}`} sub="Revise sus próximas citas o solicite una nueva hora.">
        <Link className="btn" to="/solicitar">➕ Solicitar cita</Link>
      </Encabezado>
      <Mensaje msg={msg} />

      <div className="tarjeta">
        <div className="tarjeta-titulo"><h2>Próximas citas</h2></div>
        {proximas.length === 0 && <p className="vacio">No tiene citas agendadas.</p>}
        <div className="pila">
          {proximas.map((c) => (
            <div key={c.id} className="tarjeta" style={{ boxShadow: 'none', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--primario-claro)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 84 }}>
                <b className="num" style={{ fontSize: '1.3rem', color: 'var(--primario-osc)' }}>{c.hora}</b>
                <div className="peq suave">{fechaCorta(c.fecha).slice(0, 5)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3>{c.motivo}</h3>
                <p className="suave peq">{fechaLarga(c.fecha)}</p>
                <p className="peq">{den(c.dentista_id)?.nombre} · {den(c.dentista_id)?.especialidad} · {box(c.box_id)}</p>
              </div>
              <Estado estado={c.estado} />
              <button className="btn peligro mini" onClick={() => setACancelar(c)}>Cancelar cita</button>
            </div>
          ))}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta-titulo"><h2>Historial de citas</h2></div>
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Hora</th><th>Motivo</th><th>Profesional</th><th>Estado</th></tr></thead>
            <tbody>
              {pasadas.slice(0, 12).map((c) => (
                <tr key={c.id}>
                  <td className="num">{fechaCorta(c.fecha)}</td><td className="num">{c.hora}</td>
                  <td>{c.motivo}</td><td>{den(c.dentista_id)?.nombre}</td><td><Estado estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {pasadas.length === 0 && <p className="vacio">Aún no tiene citas anteriores.</p>}
        </div>
      </div>

      {aCancelar && (
        <Modal titulo="¿Cancelar esta cita?" onCerrar={() => setACancelar(null)}>
          <p><b>{aCancelar.motivo}</b> con {den(aCancelar.dentista_id)?.nombre}</p>
          <p className="suave">{fechaLarga(aCancelar.fecha)} · {aCancelar.hora}</p>
          <div className="modal-acciones">
            <button className="btn sec" onClick={() => setACancelar(null)}>Volver</button>
            <button className="btn peligro" onClick={cancelar}>Sí, cancelar cita</button>
          </div>
        </Modal>
      )}
    </>
  )
}
