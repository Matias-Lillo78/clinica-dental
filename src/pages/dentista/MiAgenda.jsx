import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { Cargando, Encabezado, Estado, Mensaje, useDatos } from '../../components/ui'
import { actualizar, listar } from '../../lib/db'
import { fechaLarga, hoy, minutosEntre } from '../../lib/utils'

// Agenda del dentista: ve llegadas (CU-15) y pasa a registrar la atención (CU-14)
export default function MiAgenda() {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const [fecha, setFecha] = useState(hoy())
  const [msg, setMsg] = useState(null)
  const [d, recargar] = useDatos(async () => {
    const [citas, pacientes, boxes] = await Promise.all([
      listar('citas', { filtros: { dentista_id: usuario.dentista_id }, orden: 'hora' }), listar('pacientes'), listar('boxes'),
    ])
    return { citas, pacientes, boxes }
  }, [usuario])

  if (!d) return <Cargando />
  const pac = (id) => d.pacientes.find((p) => p.id === id) || {}
  const delDia = d.citas.filter((c) => c.fecha === fecha && c.estado !== 'cancelada')
  const esperando = delDia.filter((c) => c.estado === 'presente')

  const iniciar = async (c) => {
    await actualizar('citas', c.id, { estado: 'en_atencion', atencion_en: new Date().toISOString() }, 'Inicio de atención')
    setMsg({ tipo: 'ok', texto: `Atención iniciada: ${pac(c.paciente_id).nombre}.` })
    recargar()
  }

  return (
    <>
      <Encabezado titulo="Mi agenda" sub={<span>{usuario.nombre} · {fechaLarga(fecha)}</span>}>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 170 }} aria-label="Fecha" />
      </Encabezado>
      <Mensaje msg={msg} />

      {esperando.length > 0 && (
        <div className="alerta" style={{ background: 'var(--acento-claro)', borderColor: '#f5cfc2', color: '#8f3b23' }}>
          🔔 <b>{esperando.length} paciente(s) en sala de espera:</b> {esperando.map((c) => `${pac(c.paciente_id).nombre} (${c.hora})`).join(', ')}
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><span>Citas</span><b>{delDia.length}</b></div>
        <div className="kpi"><span>Esperando</span><b style={{ color: 'var(--acento)' }}>{esperando.length}</b></div>
        <div className="kpi"><span>Atendidas</span><b style={{ color: 'var(--ok)' }}>{delDia.filter((c) => c.estado === 'atendida').length}</b></div>
        <div className="kpi"><span>Por llegar</span><b>{delDia.filter((c) => ['pendiente', 'confirmada'].includes(c.estado)).length}</b></div>
      </div>

      <div className="tarjeta">
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Motivo</th><th>Box</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acción</th></tr></thead>
            <tbody>
              {delDia.map((c) => (
                <tr key={c.id}>
                  <td className="num"><b>{c.hora}</b></td>
                  <td><b>{pac(c.paciente_id).nombre}</b>{c.observacion && <div className="peq suave">📝 {c.observacion}</div>}</td>
                  <td>{c.motivo}</td>
                  <td>{d.boxes.find((b) => b.id === c.box_id)?.nombre}</td>
                  <td>
                    <Estado estado={c.estado} />
                    {c.estado === 'presente' && c.llegada_en && <div className="peq suave">{minutosEntre(c.llegada_en, new Date()) <= 120 ? `Esperando ${Math.max(0, minutosEntre(c.llegada_en, new Date()))} min` : `Llegó ${new Date(c.llegada_en).toTimeString().slice(0, 5)}`}</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="fila" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {c.estado === 'presente' && <button className="btn mini" onClick={() => iniciar(c)}>Iniciar atención</button>}
                      {c.estado === 'en_atencion' && <button className="btn mini" onClick={() => navegar(`/historial?paciente=${c.paciente_id}&cita=${c.id}`)}>Registrar atención</button>}
                      <button className="btn mini sec" onClick={() => navegar(`/historial?paciente=${c.paciente_id}`)}>Ver historial</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {delDia.length === 0 && <p className="vacio">No tiene citas para esta fecha.</p>}
        </div>
      </div>
    </>
  )
}
