import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../App'
import { Cargando, Encabezado, Estado, Mensaje, Modal, useDatos } from '../../components/ui'
import { actualizar, listar, notificar, ocupados } from '../../lib/db'
import { fechaCorta, fechaLarga, horasLibres, hoy, sumarDias } from '../../lib/utils'

// Agenda diaria: CU-04, CU-07, CU-08 y CU-10 (recepción).
// La asistente dental la ve en modo solo lectura.
export default function Agenda() {
  const { usuario } = useAuth()
  const soloLectura = usuario.rol === 'asistente'
  const [fecha, setFecha] = useState(hoy())
  const [filtroDen, setFiltroDen] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [msg, setMsg] = useState(null)
  const [modal, setModal] = useState(null) // { tipo, cita }

  const [d, recargar] = useDatos(async () => {
    const [citas, pacientes, dentistas, boxes, notifs] = await Promise.all([
      listar('citas', { orden: 'hora' }), listar('pacientes'), listar('dentistas'), listar('boxes'),
      listar('notificaciones', { filtros: { tipo: 'recordatorio' } }),
    ])
    return { citas, pacientes, dentistas, boxes, notifs }
  })

  if (!d) return <Cargando />
  const pac = (id) => d.pacientes.find((p) => p.id === id) || {}
  const den = (id) => d.dentistas.find((x) => x.id === id) || {}
  const box = (id) => d.boxes.find((b) => b.id === id)?.nombre

  let delDia = d.citas.filter((c) => c.fecha === fecha && (!filtroDen || c.dentista_id === filtroDen))
  const q = busqueda.trim().toLowerCase()
  if (q) delDia = delDia.filter((c) => pac(c.paciente_id).nombre?.toLowerCase().includes(q) || pac(c.paciente_id).rut?.includes(q))

  const activas = (c) => !['cancelada', 'no_asistio'].includes(c.estado)
  const porConfirmar = d.citas.filter((c) => c.fecha > hoy() && c.fecha <= sumarDias(hoy(), 2) && c.confirmacion !== 'confirmada' && activas(c))
    .sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora))

  const avisar = (texto, tipo = 'ok') => { setMsg({ tipo, texto }); window.dispatchEvent(new Event('notificaciones')) }

  const registrarLlegada = async (c) => {
    await actualizar('citas', c.id, { estado: 'presente', llegada_en: new Date().toISOString() }, 'Llegada registrada')
    await notificar({ para_rol: 'dentista', dentista_id: c.dentista_id, paciente_id: c.paciente_id, cita_id: c.id, tipo: 'llegada', mensaje: `${pac(c.paciente_id).nombre} llegó a recepción (cita ${c.hora}, ${box(c.box_id)}).` })
    avisar(`Llegada registrada. Se notificó a ${den(c.dentista_id).nombre}.`)
    recargar()
  }

  const marcar = async (c, cambios, texto, detalle) => {
    await actualizar('citas', c.id, cambios, detalle)
    setModal(null); avisar(texto); recargar()
  }

  const enviarRecordatorios = async () => {
    const manana = sumarDias(hoy(), 1)
    const yaEnviados = new Set(d.notifs.map((n) => n.cita_id))
    const pendientes = d.citas.filter((c) => c.fecha === manana && activas(c) && !yaEnviados.has(c.id))
    for (const c of pendientes) {
      await notificar({ para_rol: 'paciente', paciente_id: c.paciente_id, dentista_id: c.dentista_id, cita_id: c.id, tipo: 'recordatorio', mensaje: `Recordatorio: tiene una cita de ${c.motivo} con ${den(c.dentista_id).nombre} mañana ${fechaCorta(manana)} a las ${c.hora}.` })
    }
    avisar(pendientes.length ? `Se enviaron ${pendientes.length} recordatorios para mañana.` : 'Los recordatorios de mañana ya estaban enviados.', pendientes.length ? 'ok' : 'info')
    recargar()
  }

  const resumen = {
    total: delDia.filter(activas).length,
    espera: delDia.filter((c) => c.estado === 'presente').length,
    atendidas: delDia.filter((c) => c.estado === 'atendida').length,
    sinConfirmar: delDia.filter((c) => c.confirmacion !== 'confirmada' && activas(c)).length,
  }

  return (
    <>
      <Encabezado titulo={soloLectura ? 'Agenda del día (consulta)' : 'Agenda del día'} sub={<span>{fechaLarga(fecha)}</span>}>
        {!soloLectura && <button className="btn sec" onClick={enviarRecordatorios}>⏰ Enviar recordatorios de mañana</button>}
        {!soloLectura && <Link className="btn" to="/nueva-cita">➕ Registrar cita</Link>}
      </Encabezado>
      <Mensaje msg={msg} />

      <div className="kpis">
        <div className="kpi"><span>Citas del día</span><b>{resumen.total}</b></div>
        <div className="kpi"><span>En sala de espera</span><b style={{ color: 'var(--acento)' }}>{resumen.espera}</b></div>
        <div className="kpi"><span>Atendidas</span><b style={{ color: 'var(--ok)' }}>{resumen.atendidas}</b></div>
        <div className="kpi"><span>Sin confirmar</span><b style={{ color: 'var(--aviso)' }}>{resumen.sinConfirmar}</b></div>
      </div>

      <div className="tarjeta">
        <div className="fila" style={{ marginBottom: 14 }}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 170 }} aria-label="Fecha" />
          <select value={filtroDen} onChange={(e) => setFiltroDen(Number(e.target.value))} style={{ width: 230 }} aria-label="Dentista">
            <option value={0}>Todos los dentistas</option>
            {d.dentistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
          <input placeholder="Buscar paciente por nombre o RUT" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        </div>
        {q && delDia.length === 0 && <div className="alerta aviso">El paciente no posee cita programada para esta fecha.</div>}
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Box</th><th>Estado</th><th>Observación</th>{!soloLectura && <th style={{ textAlign: 'right' }}>Acciones</th>}</tr></thead>
            <tbody>
              {delDia.map((c) => (
                <tr key={c.id} style={{ opacity: activas(c) ? 1 : .55 }}>
                  <td className="num"><b>{c.hora}</b></td>
                  <td><b>{pac(c.paciente_id).nombre}</b><div className="peq suave num">{pac(c.paciente_id).telefono} · {c.motivo}</div></td>
                  <td>{den(c.dentista_id).nombre}</td>
                  <td className="nw">{box(c.box_id)}</td>
                  <td><Estado estado={c.estado} />{c.confirmacion === 'sin_respuesta' && activas(c) && <div className="peq" style={{ color: 'var(--aviso)' }}>Sin respuesta ({c.intentos_contacto})</div>}</td>
                  <td className="peq" style={{ maxWidth: 180 }}>{c.observacion || <span className="suave">—</span>}</td>
                  {!soloLectura && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="fila" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                        {['pendiente', 'confirmada'].includes(c.estado) && c.fecha === hoy() && <button className="btn mini" onClick={() => registrarLlegada(c)}>Registrar llegada</button>}
                        {['pendiente', 'confirmada'].includes(c.estado) && <button className="btn mini sec" onClick={() => setModal({ tipo: 'reprogramar', cita: c })}>Reprogramar</button>}
                        {activas(c) && c.estado !== 'atendida' && <button className="btn mini sec" onClick={() => setModal({ tipo: 'opciones', cita: c })}>Más</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {delDia.length === 0 && !q && <p className="vacio">No hay citas para esta fecha.</p>}
        </div>
      </div>

      {!soloLectura && (
        <div className="tarjeta">
          <div className="tarjeta-titulo">
            <h2>Confirmación de asistencia</h2>
            <span className="suave peq">Citas de los próximos 2 días sin confirmar</span>
          </div>
          {porConfirmar.length === 0 && <p className="vacio">Todas las citas próximas están confirmadas.</p>}
          <div className="tabla-scroll">
            <table>
              <tbody>
                {porConfirmar.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{fechaCorta(c.fecha)} {c.hora}</td>
                    <td><b>{pac(c.paciente_id).nombre}</b><div className="peq suave">{den(c.dentista_id).nombre}</div></td>
                    <td className="num">📞 {pac(c.paciente_id).telefono}</td>
                    <td>{c.intentos_contacto > 0 ? <span className="chip e-pendiente">{c.intentos_contacto} intento(s)</span> : <span className="chip e-confirmada">Por llamar</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="fila" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn mini" onClick={() => marcar(c, { confirmacion: 'confirmada', estado: 'confirmada' }, `Asistencia confirmada para ${pac(c.paciente_id).nombre}.`, 'Asistencia confirmada')}>Confirmó</button>
                        <button className="btn mini sec" onClick={() => marcar(c, { confirmacion: 'sin_respuesta', intentos_contacto: (c.intentos_contacto || 0) + 1 }, 'Intento de contacto registrado. La cita sigue pendiente de confirmación.', 'Intento de contacto sin respuesta')}>No contesta</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.tipo === 'reprogramar' && (
        <Reprogramar cita={modal.cita} d={d} onCerrar={() => setModal(null)}
          onListo={(t) => { setModal(null); avisar(t); recargar() }} />
      )}
      {modal?.tipo === 'opciones' && (
        <Opciones cita={modal.cita} paciente={pac(modal.cita.paciente_id)} onCerrar={() => setModal(null)} marcar={marcar} />
      )}
    </>
  )
}

function Opciones({ cita, paciente, onCerrar, marcar }) {
  const [obs, setObs] = useState(cita.observacion || '')
  return (
    <Modal titulo={`${paciente.nombre} · ${cita.hora}`} onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="obs">Observación de la cita</label>
        <textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej: llegó tarde, debe traer radiografía…" />
      </div>
      <button className="btn" onClick={() => marcar(cita, { observacion: obs }, 'Observación guardada.', 'Observación actualizada')}>Guardar observación</button>
      <hr style={{ border: 0, borderTop: '1px solid var(--borde)', margin: '18px 0' }} />
      <div className="fila">
        <button className="btn sec" onClick={() => marcar(cita, { estado: 'no_asistio' }, 'Cita marcada como "No asistió".', 'Paciente no asistió')}>Marcar como no asistió</button>
        <button className="btn peligro" onClick={() => marcar(cita, { estado: 'cancelada' }, 'Cita cancelada.', 'Cancelada por recepción')}>Cancelar cita</button>
      </div>
      <div className="modal-acciones"><button className="btn sec" onClick={onCerrar}>Cerrar</button></div>
    </Modal>
  )
}

// CU-08: reprogramar con validación de disponibilidad y aviso automático (CU-03, CU-15)
function Reprogramar({ cita, d, onCerrar, onListo }) {
  const [fecha, setFecha] = useState(cita.fecha < hoy() ? hoy() : cita.fecha)
  const [dentistaId, setDentistaId] = useState(cita.dentista_id)
  const [libres, setLibres] = useState([])
  const [hora, setHora] = useState(null)
  const [error, setError] = useState('')
  const p = d.pacientes.find((x) => x.id === cita.paciente_id)

  useEffect(() => {
    setHora(null)
    ocupados(fecha).then((oc) => setLibres(horasLibres(fecha, dentistaId, oc, d.boxes)))
  }, [fecha, dentistaId, d.boxes])

  const guardar = async () => {
    const oc = await ocupados(fecha)
    const libre = horasLibres(fecha, dentistaId, oc, d.boxes).find((x) => x.hora === hora)
    if (!libre) { setError('El horario seleccionado ya está ocupado. Seleccione otro horario.'); return }
    await actualizar('citas', cita.id, { fecha, hora, dentista_id: dentistaId, box_id: libre.box.id, estado: 'pendiente', confirmacion: 'pendiente' },
      `Reprogramada desde ${fechaCorta(cita.fecha)} ${cita.hora}`)
    const den = d.dentistas.find((x) => x.id === dentistaId)
    const texto = `Su cita de ${cita.motivo} fue reprogramada para el ${fechaCorta(fecha)} a las ${hora} con ${den.nombre}.`
    await notificar({ para_rol: 'paciente', paciente_id: cita.paciente_id, dentista_id: dentistaId, cita_id: cita.id, tipo: 'cambio', mensaje: texto })
    await notificar({ para_rol: 'dentista', dentista_id: dentistaId, paciente_id: cita.paciente_id, cita_id: cita.id, tipo: 'cambio', mensaje: `Cambio de agenda: ${p.nombre} pasa al ${fechaCorta(fecha)} ${hora}.` })
    if (dentistaId !== cita.dentista_id) {
      await notificar({ para_rol: 'dentista', dentista_id: cita.dentista_id, paciente_id: cita.paciente_id, cita_id: cita.id, tipo: 'cambio', mensaje: `Cambio de agenda: la cita de ${p.nombre} (${fechaCorta(cita.fecha)} ${cita.hora}) fue traspasada a ${den.nombre}.` })
    }
    onListo(`Cita reprogramada. ${p.nombre} y el dentista fueron notificados.`)
  }

  return (
    <Modal titulo="Reprogramar cita" onCerrar={onCerrar}>
      <p className="suave" style={{ marginBottom: 14 }}>{p.nombre} · actual: {fechaCorta(cita.fecha)} {cita.hora}</p>
      {error && <div className="alerta error">{error}</div>}
      <div className="grid2" style={{ gap: 12 }}>
        <div className="campo"><label htmlFor="rf">Nueva fecha</label><input id="rf" type="date" min={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div className="campo"><label htmlFor="rd">Dentista</label>
          <select id="rd" value={dentistaId} onChange={(e) => setDentistaId(Number(e.target.value))}>
            {d.dentistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      </div>
      <label>Horarios disponibles</label>
      {libres.length === 0 ? <div className="alerta aviso">No hay horarios disponibles en esta fecha.</div> : (
        <div className="horas">{libres.map((x) => <button key={x.hora} className={`hora ${hora === x.hora ? 'sel' : ''}`} onClick={() => setHora(x.hora)}>{x.hora}</button>)}</div>
      )}
      <div className="modal-acciones">
        <button className="btn sec" onClick={onCerrar}>Cancelar</button>
        <button className="btn" disabled={!hora} onClick={guardar}>Guardar y notificar</button>
      </div>
    </Modal>
  )
}
