import { useState } from 'react'
import { useAuth } from '../../App'
import { BuscadorPaciente, Cargando, Encabezado, Mensaje, Modal, useDatos } from '../../components/ui'
import { insertar, listar } from '../../lib/db'
import { estadoTratamiento, fechaCorta, hoy, pesos } from '../../lib/utils'

const MEDIOS = ['Efectivo', 'Débito', 'Crédito', 'Transferencia']

// CU-11 registrar pagos y CU-12 consultar pagos pendientes (cuotas por tratamiento)
export default function Pagos() {
  const { usuario } = useAuth()
  const [d, recargar] = useDatos(async () => {
    const [pacientes, tratamientos, pagos] = await Promise.all([
      listar('pacientes'), listar('tratamientos'), listar('pagos', { orden: 'fecha', asc: false }),
    ])
    return { pacientes, tratamientos, pagos }
  })
  const [paciente, setPaciente] = useState(null)
  const [pago, setPago] = useState(null)
  const [nuevoTrat, setNuevoTrat] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(null)

  if (!d) return <Cargando />
  const nombre = (id) => d.pacientes.find((p) => p.id === id)?.nombre

  // Alerta de cuotas vencidas en toda la clínica
  const vencidas = d.tratamientos
    .map((t) => ({ t, e: estadoTratamiento(t, d.pagos) }))
    .filter((x) => x.e.atrasado > 0)
  const totalPendiente = d.tratamientos.reduce((s, t) => s + estadoTratamiento(t, d.pagos).saldo, 0)

  const tratsPac = paciente ? d.tratamientos.filter((t) => t.paciente_id === paciente.id) : []
  const pagosPac = paciente ? d.pagos.filter((p) => p.paciente_id === paciente.id) : []

  const registrarPago = async () => {
    const t = d.tratamientos.find((x) => x.id === Number(pago.tratamiento_id))
    const monto = Number(pago.monto)
    const saldo = estadoTratamiento(t, d.pagos).saldo
    if (!monto || monto <= 0 || monto > saldo || !Number.isInteger(monto)) {
      return setError(`Monto inválido. Debe ser un número entero mayor que 0 y no superar el saldo (${pesos(saldo)}).`)
    }
    await insertar('pagos', {
      tratamiento_id: t.id, paciente_id: paciente.id, monto, fecha: hoy(), medio: pago.medio, registrado_por: usuario.nombre,
    }, `Pago de ${pesos(monto)} (tratamiento #${t.id})`)
    setPago(null); setError('')
    setMsg({ tipo: 'ok', texto: `Pago de ${pesos(monto)} registrado. Nuevo saldo: ${pesos(saldo - monto)}.` })
    recargar()
  }

  const crearTratamiento = async () => {
    const { descripcion, monto_total, cuotas } = nuevoTrat
    if (!descripcion.trim() || Number(monto_total) <= 0 || Number(cuotas) < 1) return setError('Complete descripción, monto y cuotas.')
    await insertar('tratamientos', {
      paciente_id: paciente.id, descripcion, monto_total: Number(monto_total), cuotas: Number(cuotas),
      fecha_inicio: hoy(), creado_en: new Date().toISOString(),
    }, `Tratamiento "${descripcion}" por ${pesos(monto_total)}`)
    setNuevoTrat(null); setError('')
    setMsg({ tipo: 'ok', texto: 'Tratamiento registrado con su plan de cuotas.' })
    recargar()
  }

  return (
    <>
      <Encabezado titulo="Pagos y deudas" sub="Registre pagos y revise cuotas pendientes por tratamiento." />
      <Mensaje msg={msg} />

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><span>Saldo pendiente total</span><b>{pesos(totalPendiente)}</b></div>
        <div className="kpi"><span>Tratamientos con cuotas vencidas</span><b style={{ color: 'var(--error)' }}>{vencidas.length}</b></div>
        <div className="kpi"><span>Monto atrasado</span><b style={{ color: 'var(--error)' }}>{pesos(vencidas.reduce((s, x) => s + x.e.atrasado, 0))}</b></div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.3fr', alignItems: 'start' }}>
        <div>
          <div className="tarjeta">
            <h2 style={{ marginBottom: 12 }}>Buscar paciente</h2>
            <BuscadorPaciente pacientes={d.pacientes} onElegir={setPaciente} elegido={paciente?.id} />
            {paciente && <div className="alerta info" style={{ marginBottom: 0 }}><b>{paciente.nombre}</b> · {paciente.rut}</div>}
          </div>
          <div className="tarjeta">
            <div className="tarjeta-titulo"><h2>⚠ Cuotas vencidas</h2></div>
            {vencidas.length === 0 && <p className="vacio">No hay cuotas vencidas.</p>}
            {vencidas.map(({ t, e }) => (
              <button key={t.id} className="btn sec" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8, whiteSpace: 'normal', textAlign: 'left' }}
                onClick={() => setPaciente(d.pacientes.find((p) => p.id === t.paciente_id))}>
                <span><b>{nombre(t.paciente_id)}</b><br /><span className="peq suave">{t.descripcion}</span></span>
                <span className="num" style={{ color: 'var(--error)' }}>{pesos(e.atrasado)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tarjeta">
          {!paciente && <p className="vacio">Seleccione un paciente para ver sus tratamientos, cuotas e historial de pagos.</p>}
          {paciente && (
            <>
              <div className="tarjeta-titulo">
                <h2>{paciente.nombre}</h2>
                <div className="fila">
                  <button className="btn sec mini" onClick={() => { setError(''); setNuevoTrat({ descripcion: '', monto_total: '', cuotas: 1 }) }}>Nuevo tratamiento</button>
                  <button className="btn mini" disabled={!tratsPac.length} onClick={() => { setError(''); setPago({ tratamiento_id: tratsPac[0]?.id, monto: '', medio: 'Efectivo' }) }}>Registrar pago</button>
                </div>
              </div>
              {tratsPac.length === 0 && <div className="alerta info">El paciente no tiene tratamientos ni pagos registrados.</div>}
              <div className="pila">
                {tratsPac.map((t) => {
                  const e = estadoTratamiento(t, d.pagos)
                  return (
                    <div key={t.id} className="tarjeta" style={{ boxShadow: 'none', padding: 16 }}>
                      <div className="fila" style={{ justifyContent: 'space-between' }}>
                        <h3>{t.descripcion}</h3>
                        {e.atrasado > 0 ? <span className="chip e-presente">Cuota vencida</span> : e.saldo === 0 ? <span className="chip e-atendida">Pagado</span> : <span className="chip e-confirmada">Al día</span>}
                      </div>
                      <p className="peq suave" style={{ margin: '4px 0 10px' }}>Inicio {fechaCorta(t.fecha_inicio)} · {t.cuotas} cuota(s) de {pesos(e.cuota)}</p>
                      <div className="barra-progreso"><div style={{ width: `${(e.pagado / t.monto_total) * 100}%` }} /></div>
                      <div className="fila peq num" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                        <span>Pagado <b>{pesos(e.pagado)}</b> ({e.cuotasPagadas}/{t.cuotas} cuotas)</span>
                        <span>Saldo <b>{pesos(e.saldo)}</b></span>
                      </div>
                      {e.atrasado > 0 && <p className="peq" style={{ color: 'var(--error)', marginTop: 6 }}>Monto atrasado: {pesos(e.atrasado)}</p>}
                    </div>
                  )
                })}
              </div>
              {pagosPac.length > 0 && (
                <>
                  <h3 style={{ margin: '18px 0 6px' }}>Historial de pagos</h3>
                  <div className="tabla-scroll">
                    <table>
                      <thead><tr><th>Fecha</th><th>Tratamiento</th><th>Medio</th><th>Registró</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
                      <tbody>
                        {pagosPac.map((p) => (
                          <tr key={p.id}>
                            <td className="num">{fechaCorta(p.fecha)}</td>
                            <td className="peq">{d.tratamientos.find((t) => t.id === p.tratamiento_id)?.descripcion}</td>
                            <td>{p.medio}</td><td className="peq suave">{p.registrado_por}</td>
                            <td className="num" style={{ textAlign: 'right' }}><b>{pesos(p.monto)}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {pago && (
        <Modal titulo="Registrar pago" onCerrar={() => setPago(null)}>
          {error && <div className="alerta error">{error}</div>}
          <div className="campo"><label htmlFor="pt">Tratamiento</label>
            <select id="pt" value={pago.tratamiento_id} onChange={(e) => setPago({ ...pago, tratamiento_id: e.target.value })}>
              {tratsPac.map((t) => <option key={t.id} value={t.id}>{t.descripcion} — saldo {pesos(estadoTratamiento(t, d.pagos).saldo)}</option>)}
            </select>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="campo"><label htmlFor="pm">Monto (CLP)</label><input id="pm" inputMode="numeric" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></div>
            <div className="campo"><label htmlFor="pmd">Medio de pago</label>
              <select id="pmd" value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select>
            </div>
          </div>
          <div className="modal-acciones">
            <button className="btn sec" onClick={() => setPago(null)}>Cancelar</button>
            <button className="btn" onClick={registrarPago}>Registrar pago</button>
          </div>
        </Modal>
      )}
      {nuevoTrat && (
        <Modal titulo="Nuevo tratamiento / presupuesto" onCerrar={() => setNuevoTrat(null)}>
          {error && <div className="alerta error">{error}</div>}
          <div className="campo"><label htmlFor="td">Descripción</label><input id="td" value={nuevoTrat.descripcion} onChange={(e) => setNuevoTrat({ ...nuevoTrat, descripcion: e.target.value })} /></div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="campo"><label htmlFor="tm">Monto total (CLP)</label><input id="tm" inputMode="numeric" value={nuevoTrat.monto_total} onChange={(e) => setNuevoTrat({ ...nuevoTrat, monto_total: e.target.value })} /></div>
            <div className="campo"><label htmlFor="tc">N.º de cuotas</label><input id="tc" type="number" min="1" max="36" value={nuevoTrat.cuotas} onChange={(e) => setNuevoTrat({ ...nuevoTrat, cuotas: e.target.value })} /></div>
          </div>
          <div className="modal-acciones">
            <button className="btn sec" onClick={() => setNuevoTrat(null)}>Cancelar</button>
            <button className="btn" onClick={crearTratamiento}>Guardar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
