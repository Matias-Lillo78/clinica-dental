import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BuscadorPaciente, Cargando, Encabezado, Mensaje, useDatos } from '../../components/ui'
import { insertar, listar, notificar, ocupados } from '../../lib/db'
import { fechaCorta, horasLibres, hoy } from '../../lib/utils'

const MOTIVOS = ['Evaluación', 'Control', 'Limpieza', 'Dolor de muela', 'Ajuste de brackets', 'Tapadura', 'Tratamiento de conducto']

// CU-06: la recepcionista registra una cita (incluye CU-05 consultar disponibilidad)
export default function NuevaCita() {
  const [params] = useSearchParams()
  const [cat] = useDatos(async () => {
    const [pacientes, dentistas, boxes] = await Promise.all([listar('pacientes'), listar('dentistas'), listar('boxes')])
    return { pacientes, dentistas, boxes }
  })
  const [paciente, setPaciente] = useState(null)
  const [fecha, setFecha] = useState(params.get('fecha') || hoy())
  const [dentistaId, setDentistaId] = useState(Number(params.get('dentista')) || 1)
  const [hora, setHora] = useState(params.get('hora') || '')
  const [boxId, setBoxId] = useState(0)
  const [motivo, setMotivo] = useState('Evaluación')
  const [oc, setOc] = useState([])
  const [msg, setMsg] = useState(null)

  useEffect(() => { ocupados(fecha).then(setOc) }, [fecha, msg])

  if (!cat) return <Cargando />
  const libres = horasLibres(fecha, dentistaId, oc, cat.boxes)
  const boxesLibres = cat.boxes.filter((b) => !oc.some((o) => o.hora === hora && o.box_id === b.id))

  const guardar = async () => {
    if (!paciente || !hora) return setMsg({ tipo: 'error', texto: 'Seleccione paciente y horario.' })
    // Validación final de disponibilidad (flujo alternativo: horario ocupado)
    const ahora = await ocupados(fecha)
    const box = boxId || horasLibres(fecha, dentistaId, ahora, cat.boxes).find((x) => x.hora === hora)?.box?.id
    const choca = ahora.some((o) => o.hora === hora && (o.dentista_id === dentistaId || o.box_id === box))
    if (choca || !box) { setHora(''); return setMsg({ tipo: 'error', texto: 'El horario ya no está disponible. Seleccione otro horario.' }) }
    const cita = await insertar('citas', {
      paciente_id: paciente.id, dentista_id: dentistaId, box_id: box, fecha, hora, motivo,
      estado: 'confirmada', confirmacion: 'confirmada', intentos_contacto: 0, observacion: '',
      llegada_en: null, atencion_en: null, creado_en: new Date().toISOString(),
    }, 'Cita registrada por recepción')
    const den = cat.dentistas.find((x) => x.id === dentistaId)
    await notificar({ para_rol: 'paciente', paciente_id: paciente.id, dentista_id: dentistaId, cita_id: cita.id, tipo: 'confirmacion', mensaje: `Su cita de ${motivo} quedó agendada para el ${fechaCorta(fecha)} a las ${hora} con ${den.nombre}.` })
    setMsg({ tipo: 'ok', texto: `Cita registrada: ${paciente.nombre}, ${fechaCorta(fecha)} ${hora}, ${den.nombre}. Se envió la confirmación al paciente.` })
    setHora(''); setPaciente(null); setBoxId(0)
  }

  return (
    <>
      <Encabezado titulo="Registrar cita" sub="Busque al paciente y seleccione un horario disponible." >
        <Link className="btn sec" to="/disponibilidad">Ver disponibilidad completa</Link>
      </Encabezado>
      <Mensaje msg={msg} />
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="tarjeta">
          <h2 style={{ marginBottom: 14 }}>1. Paciente</h2>
          <BuscadorPaciente pacientes={cat.pacientes} onElegir={setPaciente} elegido={paciente?.id} />
          {paciente ? (
            <div className="alerta info"><b>{paciente.nombre}</b> · {paciente.rut}<br />{paciente.telefono} · {paciente.correo}</div>
          ) : (
            <p className="peq suave">¿No está registrado? <Link to="/pacientes?nuevo=1">Registrar paciente nuevo</Link></p>
          )}
          <div className="campo">
            <label htmlFor="mot">Motivo</label>
            <select id="mot" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
        </div>

        <div className="tarjeta">
          <h2 style={{ marginBottom: 14 }}>2. Fecha, profesional y box</h2>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="campo"><label htmlFor="f">Fecha</label><input id="f" type="date" min={hoy()} value={fecha} onChange={(e) => { setFecha(e.target.value); setHora('') }} /></div>
            <div className="campo"><label htmlFor="dn">Dentista</label>
              <select id="dn" value={dentistaId} onChange={(e) => { setDentistaId(Number(e.target.value)); setHora('') }}>
                {cat.dentistas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
          </div>
          <label>Horarios disponibles</label>
          {libres.length === 0 ? <div className="alerta aviso">Sin horarios disponibles para este dentista en la fecha.</div> : (
            <div className="horas" style={{ marginBottom: 14 }}>
              {libres.map((x) => <button key={x.hora} className={`hora ${hora === x.hora ? 'sel' : ''}`} onClick={() => { setHora(x.hora); setBoxId(0) }}>{x.hora}</button>)}
            </div>
          )}
          {hora && (
            <div className="campo">
              <label htmlFor="bx">Box</label>
              <select id="bx" value={boxId} onChange={(e) => setBoxId(Number(e.target.value))}>
                <option value={0}>Asignar automáticamente</option>
                {boxesLibres.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
          )}
          <button className="btn" onClick={guardar} disabled={!paciente || !hora}>Registrar cita</button>
        </div>
      </div>
    </>
  )
}
