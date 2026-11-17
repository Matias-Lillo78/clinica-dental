import { useState } from 'react'
import { Cargando, Encabezado, useDatos } from '../../components/ui'
import { listar } from '../../lib/db'
import { ROLES, fechaHora } from '../../lib/utils'

const TABLAS = { citas: 'Citas', diagnosticos: 'Diagnósticos', procedimientos: 'Procedimientos', pagos: 'Pagos', tratamientos: 'Tratamientos', pacientes: 'Pacientes' }

// RNF-04 y RNF-05: quién modificó información clínica o financiera y cuándo
export default function Auditoria() {
  const [tabla, setTabla] = useState('')
  const [lista] = useDatos(() => listar('auditoria', { orden: 'fecha', asc: false }))
  if (!lista) return <Cargando />
  const filas = lista.filter((x) => !tabla || x.tabla === tabla)

  return (
    <>
      <Encabezado titulo="Registro de auditoría" sub="Trazabilidad de cambios en información clínica, financiera y de agenda.">
        <select value={tabla} onChange={(e) => setTabla(e.target.value)} style={{ width: 200 }} aria-label="Filtrar por tabla">
          <option value="">Todos los módulos</option>
          {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Encabezado>
      <div className="tarjeta">
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead>
            <tbody>
              {filas.map((x) => (
                <tr key={x.id}>
                  <td className="num">{fechaHora(x.fecha)}</td>
                  <td><b>{x.usuario}</b><div className="peq suave">{ROLES[x.rol]}</div></td>
                  <td><span className={`chip ${x.accion === 'INSERT' ? 'e-atendida' : 'e-confirmada'}`}>{x.accion === 'INSERT' ? 'Creación' : 'Modificación'}</span></td>
                  <td>{TABLAS[x.tabla] || x.tabla} <span className="suave num">#{x.registro_id}</span></td>
                  <td className="peq">{x.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="vacio">Sin registros.</p>}
        </div>
      </div>
    </>
  )
}
