import { useState } from 'react'
import { Cargando, Encabezado, useDatos } from '../../components/ui'
import { listar } from '../../lib/db'
import { estadoTratamiento, hoy, minutosEntre, pesos } from '../../lib/utils'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function Barras({ datos, formato = (v) => v }) {
  const max = Math.max(1, ...datos.map((x) => x.valor))
  return (
    <div className="barras-h">
      {datos.map((x) => (
        <div className="item" key={x.etiqueta}>
          <span className="peq">{x.etiqueta}</span>
          <div className="pista"><div style={{ width: `${(x.valor / max) * 100}%`, background: x.color }} /></div>
          <span className="num peq" style={{ textAlign: 'right' }}><b>{formato(x.valor)}</b></span>
        </div>
      ))}
    </div>
  )
}

// RNF-12: reportes mensuales para la dueña de la clínica
export default function Reportes() {
  const [mes, setMes] = useState(hoy().slice(0, 7))
  const [d] = useDatos(async () => {
    const [citas, procedimientos, pagos, tratamientos, dentistas] = await Promise.all([
      listar('citas'), listar('procedimientos'), listar('pagos'), listar('tratamientos'), listar('dentistas'),
    ])
    return { citas, procedimientos, pagos, tratamientos, dentistas }
  })
  if (!d) return <Cargando />

  const citasMes = d.citas.filter((c) => c.fecha.startsWith(mes) && c.fecha <= hoy())
  const cuenta = (e) => citasMes.filter((c) => c.estado === e).length
  const atendidas = citasMes.filter((c) => c.estado === 'atendida')
  const conEspera = atendidas.filter((c) => c.llegada_en && c.atencion_en).map((c) => ({ ...c, espera: minutosEntre(c.llegada_en, c.atencion_en) }))
  const prom = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x.espera, 0) / arr.length) : 0)
  const procMes = d.procedimientos.filter((p) => p.fecha.startsWith(mes))
  const ingresos = d.pagos.filter((p) => p.fecha.startsWith(mes)).reduce((s, p) => s + Number(p.monto), 0)
  const estados = d.tratamientos.map((t) => estadoTratamiento(t, d.pagos))
  const pendiente = estados.reduce((s, e) => s + e.saldo, 0)
  const atrasado = estados.reduce((s, e) => s + e.atrasado, 0)

  const porDia = [1, 2, 3, 4, 5].map((n) => ({
    etiqueta: DIAS[n], valor: prom(conEspera.filter((c) => new Date(c.fecha + 'T12:00:00').getDay() === n)),
  }))
  const maxDia = Math.max(...porDia.map((x) => x.valor))
  porDia.forEach((x) => { x.color = x.valor === maxDia ? 'var(--acento)' : 'var(--primario)' })
  const porFranja = [['09:00–11:00', '09:00', '11:00'], ['11:00–13:00', '11:00', '13:00'], ['14:00–16:00', '14:00', '16:00'], ['16:00–18:00', '16:00', '18:00']]
    .map(([e, a, b]) => ({ etiqueta: e, valor: prom(conEspera.filter((c) => c.hora >= a && c.hora < b)) }))
  const maxF = Math.max(...porFranja.map((x) => x.valor))
  porFranja.forEach((x) => { x.color = x.valor === maxF ? 'var(--acento)' : 'var(--primario)' })

  const tipos = {}
  procMes.forEach((p) => { tipos[p.descripcion] = (tipos[p.descripcion] || 0) + 1 })
  const topProc = Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([etiqueta, valor]) => ({ etiqueta, valor }))
  const porDentista = d.dentistas.map((x) => ({ etiqueta: x.nombre.replace(/^Dr[a]?\. /, ''), valor: atendidas.filter((c) => c.dentista_id === x.id).length }))

  return (
    <>
      <Encabezado titulo="Reportes de la clínica" sub="Resumen mensual de atención, asistencia, ingresos y tiempos de espera.">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 180 }} aria-label="Mes" />
        <button className="btn sec" onClick={() => window.print()}>Imprimir</button>
      </Encabezado>

      <div className="kpis">
        <div className="kpi"><span>Pacientes atendidos</span><b>{atendidas.length}</b><small>de {citasMes.length} citas</small></div>
        <div className="kpi"><span>Horas canceladas</span><b>{cuenta('cancelada')}</b><small>{citasMes.length ? Math.round((cuenta('cancelada') / citasMes.length) * 100) : 0}% del total</small></div>
        <div className="kpi"><span>No asistieron</span><b style={{ color: 'var(--error)' }}>{cuenta('no_asistio')}</b><small>{citasMes.length ? Math.round((cuenta('no_asistio') / citasMes.length) * 100) : 0}% del total</small></div>
        <div className="kpi"><span>Espera promedio</span><b>{prom(conEspera)} min</b><small>llegada → atención</small></div>
        <div className="kpi"><span>Ingresos del mes</span><b>{pesos(ingresos)}</b></div>
        <div className="kpi"><span>Pagos pendientes</span><b>{pesos(pendiente)}</b><small>saldo total por cobrar</small></div>
        <div className="kpi"><span>Cuotas vencidas</span><b style={{ color: 'var(--error)' }}>{pesos(atrasado)}</b></div>
        <div className="kpi"><span>Tratamientos realizados</span><b>{procMes.length}</b><small>procedimientos registrados</small></div>
      </div>

      <div className="grid2">
        <div className="tarjeta">
          <div className="tarjeta-titulo"><h2>Espera promedio por día</h2><span className="peq suave">minutos</span></div>
          <Barras datos={porDia} formato={(v) => v + ' min'} />
          <p className="peq suave" style={{ marginTop: 10 }}>En coral, el día con más retraso.</p>
        </div>
        <div className="tarjeta">
          <div className="tarjeta-titulo"><h2>Espera promedio por horario</h2><span className="peq suave">minutos</span></div>
          <Barras datos={porFranja} formato={(v) => v + ' min'} />
        </div>
        <div className="tarjeta" style={{ marginTop: 0 }}>
          <div className="tarjeta-titulo"><h2>Tratamientos más realizados</h2></div>
          {topProc.length ? <Barras datos={topProc} /> : <p className="vacio">Sin registros este mes.</p>}
        </div>
        <div className="tarjeta" style={{ marginTop: 0 }}>
          <div className="tarjeta-titulo"><h2>Atenciones por profesional</h2></div>
          <Barras datos={porDentista} />
        </div>
      </div>
    </>
  )
}
