import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cargando, Encabezado, Mensaje, Modal, useDatos } from '../../components/ui'
import { actualizar, insertar, listar } from '../../lib/db'
import { correoValido, fechaCorta, hoy, rutValido } from '../../lib/utils'

const VACIO = { rut: '', nombre: '', telefono: '', correo: '', direccion: '' }

function validar(f, pacientes, idActual) {
  const er = {}
  if (!rutValido(f.rut)) er.rut = 'RUT inválido (formato 12345678-9).'
  else if (pacientes.some((p) => p.rut === f.rut && p.id !== idActual)) er.rut = 'Ya existe un paciente con este RUT.'
  if (f.nombre.trim().length < 3) er.nombre = 'Campo obligatorio.'
  if (f.telefono.trim().length < 8) er.telefono = 'Campo obligatorio.'
  if (!correoValido(f.correo)) er.correo = 'Correo inválido.'
  return er
}

// CU-09: registrar pacientes y mantener actualizados sus datos de contacto
export default function Pacientes() {
  const [params] = useSearchParams()
  const [d, recargar] = useDatos(async () => {
    const [pacientes, citas] = await Promise.all([listar('pacientes', { orden: 'nombre' }), listar('citas')])
    return { pacientes, citas }
  })
  const [form, setForm] = useState(params.get('nuevo') ? { ...VACIO } : null)
  const [errores, setErrores] = useState({})
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState(null)

  if (!d) return <Cargando />
  const t = q.trim().toLowerCase()
  const lista = d.pacientes.filter((p) => !t || p.nombre.toLowerCase().includes(t) || p.rut.includes(t))
  const proxima = (id) => d.citas.filter((c) => c.paciente_id === id && c.fecha >= hoy() && ['pendiente', 'confirmada'].includes(c.estado)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0]

  const guardar = async (e) => {
    e.preventDefault()
    const er = validar(form, d.pacientes, form.id)
    setErrores(er)
    if (Object.keys(er).length) return
    const { id, ...datos } = form
    if (id) await actualizar('pacientes', id, datos, 'Datos de contacto actualizados')
    else await insertar('pacientes', { ...datos, creado_en: new Date().toISOString() }, 'Paciente registrado')
    setMsg({ tipo: 'ok', texto: id ? 'Datos del paciente actualizados.' : `Paciente ${form.nombre} registrado correctamente.` })
    setForm(null)
    recargar()
  }

  const campo = (name, texto, ph = '') => (
    <div className="campo">
      <label htmlFor={'p-' + name}>{texto}</label>
      <input id={'p-' + name} value={form[name]} placeholder={ph} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {errores[name] && <div className="error-campo">{errores[name]}</div>}
    </div>
  )

  return (
    <>
      <Encabezado titulo="Pacientes" sub={`${d.pacientes.length} pacientes registrados`}>
        <button className="btn" onClick={() => { setErrores({}); setForm({ ...VACIO }) }}>➕ Registrar paciente</button>
      </Encabezado>
      <Mensaje msg={msg} />
      <div className="tarjeta">
        <input placeholder="Buscar por nombre o RUT" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12, maxWidth: 360 }} />
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Paciente</th><th>RUT</th><th>Contacto</th><th>Próxima cita</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => {
                const c = proxima(p.id)
                return (
                  <tr key={p.id}>
                    <td><b>{p.nombre}</b><div className="peq suave">{p.direccion}</div></td>
                    <td className="num">{p.rut}</td>
                    <td className="peq">{p.telefono}<br /><span className="suave">{p.correo}</span></td>
                    <td className="num">{c ? `${fechaCorta(c.fecha)} ${c.hora}` : <span className="suave">—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="fila" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn mini sec" onClick={() => { setErrores({}); setForm({ ...p }) }}>Editar</button>
                        <Link className="btn mini sec" to="/nueva-cita">Agendar</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lista.length === 0 && <p className="vacio">No se encontraron pacientes.</p>}
        </div>
      </div>

      {form && (
        <Modal titulo={form.id ? 'Editar paciente' : 'Registrar paciente'} onCerrar={() => setForm(null)}>
          <form onSubmit={guardar} noValidate>
            {Object.keys(errores).length > 0 && <div className="alerta error">Revise los campos obligatorios marcados.</div>}
            {campo('rut', 'RUT *', '12345678-9')}
            {campo('nombre', 'Nombre completo *')}
            <div className="grid2" style={{ gap: 12 }}>{campo('telefono', 'Teléfono *', '+56 9 ...')}{campo('correo', 'Correo *')}</div>
            {campo('direccion', 'Dirección')}
            <div className="modal-acciones">
              <button type="button" className="btn sec" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
