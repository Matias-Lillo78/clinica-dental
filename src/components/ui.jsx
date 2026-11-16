import { useCallback, useEffect, useState } from 'react'
import { ESTADOS } from '../lib/utils'

// Carga datos de forma asíncrona y permite recargarlos.
export function useDatos(cargar, deps = []) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recargar = useCallback(async () => {
    try { setDatos(await cargar()); setError('') } catch (e) { setError(e.message) }
  }, deps)
  useEffect(() => { recargar() }, [recargar])
  return [datos, recargar, error]
}

export function Estado({ estado }) {
  return <span className={`chip e-${estado}`}>{ESTADOS[estado] || estado}</span>
}

export function Modal({ titulo, children, onCerrar }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

export function Encabezado({ titulo, sub, children }) {
  return (
    <div className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="fila">{children}</div>}
    </div>
  )
}

export function Mensaje({ msg }) {
  if (!msg) return null
  return <div className={`alerta ${msg.tipo}`} role="status">{msg.texto}</div>
}

export function Cargando() {
  return <div className="vacio">Cargando…</div>
}

// Buscador de pacientes por nombre o RUT (usado en varias pantallas)
export function BuscadorPaciente({ pacientes, onElegir, elegido }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const res = t.length < 2 ? [] : pacientes.filter((p) =>
    p.nombre.toLowerCase().includes(t) || p.rut.replace(/\./g, '').toLowerCase().includes(t.replace(/\./g, ''))).slice(0, 6)
  return (
    <div className="campo">
      <label htmlFor="buscar-pac">Buscar paciente (nombre o RUT)</label>
      <input id="buscar-pac" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: Pérez o 15234567-1" />
      {t.length >= 2 && (
        <div className="tarjeta" style={{ padding: 6, marginTop: 6 }}>
          {res.length === 0 && <p className="vacio peq" style={{ padding: 10 }}>No se encontraron pacientes.</p>}
          {res.map((p) => (
            <button key={p.id} type="button" className="btn sec" style={{ width: '100%', justifyContent: 'space-between', border: 0, marginBottom: 2, background: elegido === p.id ? 'var(--primario-claro)' : '#fff' }}
              onClick={() => { onElegir(p); setQ('') }}>
              <span>{p.nombre}</span><span className="suave peq num">{p.rut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
