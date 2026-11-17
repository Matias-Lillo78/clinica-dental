import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../App'
import { Cargando, Encabezado, useDatos } from '../../components/ui'
import { insertar, listar, notificar, ocupados } from '../../lib/db'
import { esFinDeSemana, fechaCorta, fechaLarga, horasLibres, hoy, sumarDias } from '../../lib/utils'

const MOTIVOS = ['Evaluación', 'Control', 'Limpieza', 'Dolor de muela', 'Ajuste de brackets', 'Tapadura', 'Tratamiento de conducto']

function siguienteHabil(f) {
  let d = f
  while (esFinDeSemana(d)) d = sumarDias(d, 1)
  return d
}

// CU-01: el paciente solicita una cita eligiendo un horario disponible
export default function SolicitarCita() {
  const { usuario } = useAuth()
  const [cat] = useDatos(async () => {
    const [dentistas, boxes] = await Promise.all([listar('dentistas'), listar('boxes')])
    return { dentistas, boxes }
  })
  const [dentistaId, setDentistaId] = useState(1)
  const [fecha, setFecha] = useState(siguienteHabil(sumarDias(hoy(), 1)))
  const [libres, setLibres] = useState(null)
  const [alternativas, setAlternativas] = useState([])
  const [eleccion, setEleccion] = useState(null)
  const [motivo, setMotivo] = useState('Evaluación')
  const [lista, setLista] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!cat) return
    setEleccion(null)
    setAviso('')
    ocupados(fecha).then(async (oc) => {
      const l = horasLibres(fecha, dentistaId, oc, cat.boxes)
      setLibres(l)
      // Flujo alternativo: sin disponibilidad → ofrecer otras fechas
      if (l.length === 0) {
        const alt = []
        for (let i = 1; alt.length < 4 && i < 20; i++) {
          const f2 = sumarDias(fecha < hoy() ? hoy() : fecha, i)
          if (horasLibres(f2, dentistaId, await ocupados(f2), cat.boxes).length) alt.push(f2)
        }
        setAlternativas(alt)
      }
    })
  }, [cat, fecha, dentistaId])

  if (!cat) return <Cargando />
  const den = cat.dentistas.find((d) => d.id === dentistaId)

  const confirmar = async () => {
    // Se vuelve a validar justo antes de guardar por si otro usuario tomó la hora
    const oc = await ocupados(fecha)
    if (!horasLibres(fecha, dentistaId, oc, cat.boxes).some((x) => x.hora === eleccion.hora)) {
      setEleccion(null)
      setLibres(horasLibres(fecha, dentistaId, oc, cat.boxes))
      return setAviso('El horario seleccionado ya no está disponible. Elija otro.')
    }
    const cita = await insertar('citas', {
      paciente_id: usuario.paciente_id, dentista_id: dentistaId, box_id: eleccion.box.id,
      fecha, hora: eleccion.hora, motivo, estado: 'confirmada', confirmacion: 'confirmada',
      intentos_contacto: 0, observacion: 'Solicitada en línea', llegada_en: null, atencion_en: null,
      creado_en: new Date().toISOString(),
    }, 'Cita solicitada en línea por el paciente')
    await notificar({ para_rol: 'recepcion', paciente_id: usuario.paciente_id, cita_id: cita.id, tipo: 'solicitud', mensaje: `${usuario.nombre} solicitó una cita en línea para el ${fechaCorta(fecha)} a las ${eleccion.hora} con ${den.nombre}.` })
    await notificar({ para_rol: 'paciente', paciente_id: usuario.paciente_id, cita_id: cita.id, tipo: 'confirmacion', mensaje: `Su cita de ${motivo} quedó agendada para el ${fechaCorta(fecha)} a las ${eleccion.hora} con ${den.nombre} (${eleccion.box.nombre}).` })
    window.dispatchEvent(new Event('notificaciones'))
    setLista(cita)
  }

  if (lista) {
    return (
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <div className="alerta ok">✔ Su cita quedó registrada y confirmada.</div>
        <h2>{lista.motivo}</h2>
        <p style={{ marginTop: 6 }}>{fechaLarga(lista.fecha)} · <b className="num">{lista.hora}</b></p>
        <p className="suave">{den.nombre} · {den.especialidad}</p>
        <p className="peq suave" style={{ marginTop: 10 }}>Recibirá un recordatorio antes de la cita y un aviso si hay cambios.</p>
        <div className="fila" style={{ marginTop: 18 }}>
          <Link className="btn" to="/mis-citas">Ver mis citas</Link>
          <button className="btn sec" onClick={() => { setLista(null); setEleccion(null) }}>Solicitar otra</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Encabezado titulo="Solicitar cita" sub="Elija profesional, fecha y un horario disponible." />
      <div className="grid2" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        <div className="tarjeta">
          <div className="campo">
            <label htmlFor="den">Profesional / especialidad</label>
            <select id="den" value={dentistaId} onChange={(e) => setDentistaId(Number(e.target.value))}>
              {cat.dentistas.map((d) => <option key={d.id} value={d.id}>{d.nombre} — {d.especialidad}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" min={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="motivo">Motivo de la consulta</label>
            <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <p className="peq suave">Datos de contacto: {usuario.email}</p>
        </div>

        <div className="tarjeta">
          <div className="tarjeta-titulo">
            <h2>{fechaLarga(fecha)}</h2>
            <span className="suave peq">{den.nombre}</span>
          </div>
          {aviso && <div className="alerta error">{aviso}</div>}
          {libres === null && <Cargando />}
          {libres?.length === 0 && (
            <>
              <div className="alerta aviso">No hay horarios disponibles para esta fecha{esFinDeSemana(fecha) ? ' (la clínica atiende de lunes a viernes)' : ''}.</div>
              {alternativas.length > 0 && <p className="peq" style={{ marginBottom: 8 }}><b>Fechas alternativas con horas libres:</b></p>}
              <div className="horas">
                {alternativas.map((f) => <button key={f} className="hora" onClick={() => setFecha(f)}>{fechaCorta(f)}</button>)}
              </div>
            </>
          )}
          {libres?.length > 0 && (
            <>
              <p className="peq suave" style={{ marginBottom: 10 }}>{libres.length} horarios disponibles</p>
              <div className="horas">
                {libres.map((x) => (
                  <button key={x.hora} className={`hora ${eleccion?.hora === x.hora ? 'sel' : ''}`} onClick={() => setEleccion(x)} aria-pressed={eleccion?.hora === x.hora}>{x.hora}</button>
                ))}
              </div>
            </>
          )}
          {eleccion && (
            <div className="alerta info" style={{ marginTop: 18, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>{motivo} · <b>{eleccion.hora}</b> · {den.nombre}</span>
              <button className="btn" onClick={confirmar}>Confirmar cita</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
