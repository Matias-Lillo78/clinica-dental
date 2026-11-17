import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../App'
import { BuscadorPaciente, Cargando, Encabezado, Mensaje, useDatos } from '../../components/ui'
import { actualizar, insertar, listar } from '../../lib/db'
import { fechaCorta, hoy } from '../../lib/utils'

const VACIO = { diagnostico: '', procedimiento: '', indicaciones: '', pendientes: '', costo: '' }

// CU-13 consultar y CU-14 registrar historial clínico.
// Solo los dentistas registran; administración puede consultar (RNF-02).
export default function Historial() {
  const { usuario } = useAuth()
  const puedeRegistrar = usuario.rol === 'dentista'
  const [params, setParams] = useSearchParams()
  const pacienteId = Number(params.get('paciente')) || null
  const citaId = Number(params.get('cita')) || null
  const [form, setForm] = useState(citaId ? { ...VACIO } : null)
  const [errores, setErrores] = useState({})
  const [msg, setMsg] = useState(null)

  const [d, recargar] = useDatos(async () => {
    const [pacientes, dentistas, diagnosticos, procedimientos] = await Promise.all([
      listar('pacientes'), listar('dentistas'), listar('diagnosticos'), listar('procedimientos'),
    ])
    return { pacientes, dentistas, diagnosticos, procedimientos }
  })
  if (!d) return <Cargando />

  const paciente = d.pacientes.find((p) => p.id === pacienteId)
  const den = (id) => d.dentistas.find((x) => x.id === id)

  // Agrupa diagnósticos y procedimientos por fecha y profesional
  const eventos = {}
  if (paciente) {
    for (const x of d.diagnosticos.filter((x) => x.paciente_id === pacienteId)) {
      const k = x.fecha + '|' + x.dentista_id
      ;(eventos[k] ||= { fecha: x.fecha, dentista_id: x.dentista_id, diag: [], proc: [] }).diag.push(x)
    }
    for (const x of d.procedimientos.filter((x) => x.paciente_id === pacienteId)) {
      const k = x.fecha + '|' + x.dentista_id
      ;(eventos[k] ||= { fecha: x.fecha, dentista_id: x.dentista_id, diag: [], proc: [] }).proc.push(x)
    }
  }
  const linea = Object.values(eventos).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const pendientes = d.procedimientos.filter((x) => x.paciente_id === pacienteId && x.pendientes).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]

  const guardar = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.diagnostico.trim()) er.diagnostico = 'El diagnóstico es obligatorio.'
    if (!form.procedimiento.trim()) er.procedimiento = 'El procedimiento realizado es obligatorio.'
    setErrores(er)
    if (Object.keys(er).length) return
    const base = { paciente_id: pacienteId, dentista_id: usuario.dentista_id, cita_id: citaId, fecha: hoy() }
    await insertar('diagnosticos', { ...base, descripcion: form.diagnostico }, `Nuevo diagnóstico para paciente #${pacienteId}`)
    await insertar('procedimientos', {
      ...base, descripcion: form.procedimiento, indicaciones: form.indicaciones, pendientes: form.pendientes, costo: Number(form.costo) || 0,
    }, `Nuevo procedimiento para paciente #${pacienteId}`)
    if (citaId) await actualizar('citas', citaId, { estado: 'atendida' }, 'Atención finalizada')
    setForm(null)
    setParams({ paciente: pacienteId })
    setMsg({ tipo: 'ok', texto: 'Atención registrada en el historial clínico.' + (citaId ? ' La cita quedó como atendida.' : '') })
    recargar()
  }

  const area = (name, texto, req) => (
    <div className="campo">
      <label htmlFor={'h-' + name}>{texto}{req && ' *'}</label>
      <textarea id={'h-' + name} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {errores[name] && <div className="error-campo">{errores[name]}</div>}
    </div>
  )

  return (
    <>
      <Encabezado titulo="Historial clínico" sub={puedeRegistrar ? 'Consulte antecedentes y registre la atención realizada.' : 'Consulta de antecedentes clínicos (solo lectura).'} />
      <Mensaje msg={msg} />
      <div className="grid2" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
        <div className="tarjeta">
          <BuscadorPaciente pacientes={d.pacientes} elegido={pacienteId} onElegir={(p) => { setParams({ paciente: p.id }); setForm(null); setMsg(null) }} />
          {paciente && (
            <div className="pila peq">
              <div><b style={{ fontSize: '1rem' }}>{paciente.nombre}</b><div className="suave num">{paciente.rut}</div></div>
              <div>📞 {paciente.telefono}<br />✉ {paciente.correo}</div>
              {pendientes && <div className="alerta aviso" style={{ marginBottom: 0 }}><b>Pendiente:</b> {pendientes.pendientes}</div>}
              {puedeRegistrar && !form && <button className="btn" onClick={() => { setErrores({}); setForm({ ...VACIO }) }}>➕ Registrar atención</button>}
            </div>
          )}
        </div>

        <div>
          {form && paciente && (
            <form className="tarjeta" onSubmit={guardar} noValidate style={{ marginBottom: 18 }}>
              <div className="tarjeta-titulo"><h2>Registrar atención · {fechaCorta(hoy())}</h2>{citaId && <span className="chip e-en_atencion">Cita en curso</span>}</div>
              {Object.keys(errores).length > 0 && <div className="alerta error">Falta información obligatoria.</div>}
              {area('diagnostico', 'Diagnóstico', true)}
              {area('procedimiento', 'Procedimiento realizado', true)}
              <div className="grid2" style={{ gap: 12 }}>{area('indicaciones', 'Indicaciones al paciente')}{area('pendientes', 'Tratamientos pendientes')}</div>
              <div className="campo" style={{ maxWidth: 220 }}><label htmlFor="h-costo">Costo del procedimiento (CLP)</label><input id="h-costo" inputMode="numeric" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></div>
              <div className="fila"><button className="btn">Guardar en historial</button><button type="button" className="btn sec" onClick={() => setForm(null)}>Cancelar</button></div>
            </form>
          )}

          <div className="tarjeta">
            {!paciente && <p className="vacio">Busque un paciente para ver su historial clínico.</p>}
            {paciente && linea.length === 0 && <div className="alerta info">No existen antecedentes clínicos registrados para este paciente.</div>}
            {paciente && linea.length > 0 && (
              <>
                <h2 style={{ marginBottom: 16 }}>Antecedentes ({linea.length} atenciones)</h2>
                <div className="linea-tiempo">
                  {linea.map((ev) => (
                    <div className="evento" key={ev.fecha + ev.dentista_id}>
                      <div className="meta">{fechaCorta(ev.fecha)} · registrado por <b>{den(ev.dentista_id)?.nombre}</b> ({den(ev.dentista_id)?.especialidad})</div>
                      {ev.diag.map((x) => <p key={'d' + x.id}><b>Diagnóstico:</b> {x.descripcion}</p>)}
                      {ev.proc.map((x) => (
                        <div key={'p' + x.id} style={{ marginTop: 4 }}>
                          <p><b>Procedimiento:</b> {x.descripcion}</p>
                          {x.indicaciones && <p className="peq suave">Indicaciones: {x.indicaciones}</p>}
                          {x.pendientes && <p className="peq" style={{ color: 'var(--aviso)' }}>Pendiente: {x.pendientes}</p>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
