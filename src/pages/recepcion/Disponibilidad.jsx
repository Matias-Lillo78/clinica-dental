import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cargando, Encabezado, useDatos } from '../../components/ui'
import { listar } from '../../lib/db'
import { HORAS, esFinDeSemana, fechaCorta, fechaLarga, horasLibres, hoy, sumarDias } from '../../lib/utils'

// CU-05: disponibilidad de dentistas y box en una fecha
export default function Disponibilidad() {
  const navegar = useNavigate()
  const [fecha, setFecha] = useState(hoy())
  const [d] = useDatos(async () => {
    const [citas, pacientes, dentistas, boxes] = await Promise.all([
      listar('citas'), listar('pacientes'), listar('dentistas'), listar('boxes'),
    ])
    return { citas, pacientes, dentistas, boxes }
  })
  if (!d) return <Cargando />

  const ocupadosDe = (f) => d.citas.filter((c) => c.fecha === f && c.estado !== 'cancelada')
  const oc = ocupadosDe(fecha)
  const libresTotal = d.dentistas.reduce((s, x) => s + horasLibres(fecha, x.id, oc, d.boxes).length, 0)
  const alternativas = []
  for (let i = 1; libresTotal === 0 && alternativas.length < 4 && i < 15; i++) {
    const f = sumarDias(fecha, i)
    if (d.dentistas.some((x) => horasLibres(f, x.id, ocupadosDe(f), d.boxes).length)) alternativas.push(f)
  }

  return (
    <>
      <Encabezado titulo="Disponibilidad" sub="Horarios libres por dentista y box. Haga clic en un bloque libre para agendar.">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 170 }} aria-label="Fecha" />
      </Encabezado>

      {libresTotal === 0 && (
        <div className="alerta aviso">
          No hay horarios disponibles el {fechaCorta(fecha)}{esFinDeSemana(fecha) ? ' (fin de semana)' : ''}.
          {alternativas.length > 0 && <> Fechas alternativas: {alternativas.map((f) => (
            <button key={f} className="btn mini sec" style={{ marginLeft: 6 }} onClick={() => setFecha(f)}>{fechaCorta(f)}</button>
          ))}</>}
        </div>
      )}

      <div className="tarjeta">
        <div className="tarjeta-titulo">
          <h2>{fechaLarga(fecha)}</h2>
          <span className="suave peq">{libresTotal} bloques libres · {d.boxes.length} box</span>
        </div>
        <div className="tabla-scroll">
          <table className="grilla">
            <thead>
              <tr><th>Hora</th>{d.dentistas.map((x) => <th key={x.id}>{x.nombre}<div className="peq" style={{ textTransform: 'none', fontWeight: 500 }}>{x.especialidad}</div></th>)}<th>Box libres</th></tr>
            </thead>
            <tbody>
              {HORAS.map((h) => {
                const enHora = oc.filter((c) => c.hora === h)
                const boxesLibres = d.boxes.filter((b) => !enHora.some((c) => c.box_id === b.id))
                return (
                  <tr key={h}>
                    <td className="num"><b>{h}</b></td>
                    {d.dentistas.map((x) => {
                      const cita = enHora.find((c) => c.dentista_id === x.id)
                      const libre = horasLibres(fecha, x.id, oc, d.boxes).some((l) => l.hora === h)
                      if (cita) return <td key={x.id} className="ocupado">{d.pacientes.find((p) => p.id === cita.paciente_id)?.nombre}</td>
                      if (libre) return <td key={x.id} className="libre" onClick={() => navegar(`/nueva-cita?fecha=${fecha}&hora=${h}&dentista=${x.id}`)}>Libre</td>
                      return <td key={x.id} className="ocupado">—</td>
                    })}
                    <td className="num peq">{boxesLibres.map((b) => b.nombre.replace('Box ', 'B')).join(' · ') || 'Ninguno'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
