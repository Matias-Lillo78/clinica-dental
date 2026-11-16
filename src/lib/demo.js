// Modo demostración: simula las tablas de Supabase en el navegador para
// poder revisar el prototipo sin conexión. Los datos se generan a partir
// de la fecha actual para que siempre haya agenda "de hoy".
import { HORAS, hoy, sumarDias, sumarMeses } from './utils'

const KEY = 'clinica-dental-demo-v1'
export const CLAVE_DEMO = 'Demo1234'

export const USUARIOS_DEMO = [
  { id: 'u-admin', email: 'admin@clinica.cl', nombre: 'Patricia Lagos', rol: 'admin' },
  { id: 'u-recep', email: 'recepcion@clinica.cl', nombre: 'Camila Torres', rol: 'recepcionista' },
  { id: 'u-dent1', email: 'dentista@clinica.cl', nombre: 'Dra. Carolina Muñoz', rol: 'dentista', dentista_id: 1 },
  { id: 'u-dent2', email: 'ortodoncia@clinica.cl', nombre: 'Dr. Felipe Rojas', rol: 'dentista', dentista_id: 2 },
  { id: 'u-asist', email: 'asistente@clinica.cl', nombre: 'Javiera Pinto', rol: 'asistente' },
  { id: 'u-pac', email: 'paciente@clinica.cl', nombre: 'Juan Pérez', rol: 'paciente', paciente_id: 1 },
]

// Generador pseudoaleatorio con semilla fija (datos siempre iguales)
function azar(semilla) {
  let s = semilla
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

function dv(num) {
  let suma = 0, mul = 2
  const s = String(num)
  for (let i = s.length - 1; i >= 0; i--) {
    suma += Number(s[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (suma % 11)
  return `${num}-${r === 11 ? '0' : r === 10 ? 'K' : r}`
}

function semilla() {
  const r = azar(42)
  const H = hoy()
  const ahora = new Date()
  const iso = (fecha, hora, extraMin = 0) => {
    const d = new Date(`${fecha}T${hora}:00`)
    d.setMinutes(d.getMinutes() + extraMin)
    return d.toISOString()
  }

  const dentistas = [
    { id: 1, nombre: 'Dra. Carolina Muñoz', especialidad: 'Odontología general', telefono: '+56 9 6123 4501', correo: 'dentista@clinica.cl' },
    { id: 2, nombre: 'Dr. Felipe Rojas', especialidad: 'Ortodoncia', telefono: '+56 9 6123 4502', correo: 'ortodoncia@clinica.cl' },
    { id: 3, nombre: 'Dra. Valentina Soto', especialidad: 'Endodoncia', telefono: '+56 9 6123 4503', correo: 'vsoto@clinica.cl' },
  ]
  const boxes = [
    { id: 1, nombre: 'Box 1', activo: true },
    { id: 2, nombre: 'Box 2', activo: true },
    { id: 3, nombre: 'Box 3', activo: true },
  ]
  const nombres = [
    'Juan Pérez', 'María González', 'Pedro Soto', 'Fernanda Díaz', 'Tomás Herrera',
    'Constanza Vega', 'Ignacio Fuentes', 'Rocío Morales', 'Diego Castillo', 'Antonia Reyes',
  ]
  const pacientes = nombres.map((n, i) => ({
    id: i + 1,
    rut: dv(15234567 + i * 731911),
    nombre: n,
    telefono: `+56 9 ${7100 + i * 37} ${4200 + i * 113}`,
    correo: i === 0 ? 'paciente@clinica.cl' : n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@correo.cl',
    direccion: ['Av. Arica 1450, Arica', 'Calle Baquedano 720, Iquique', 'Av. Brasil 2210, Arica', 'Pasaje Los Aromos 33, Arica', 'Av. Santa María 980, Arica'][i % 5],
    creado_en: iso(sumarDias(H, -120 + i * 5), '10:00'),
  }))

  const motivos = ['Control', 'Limpieza', 'Dolor de muela', 'Ajuste de brackets', 'Evaluación', 'Tapadura', 'Tratamiento de conducto']
  const citas = []
  const diagnosticos = []
  const procedimientos = []
  let id = 1

  // Citas pasadas (últimos 60 días) para historial y reportes
  for (let d = -60; d <= 10; d++) {
    const fecha = sumarDias(H, d)
    const dia = new Date(fecha + 'T12:00:00').getDay()
    if (dia === 0 || dia === 6) continue
    for (const den of dentistas) {
      const usadas = new Set()
      const cantidad = d === 0 ? 0 : 2 + Math.floor(r() * 3)
      for (let k = 0; k < cantidad; k++) {
        const hora = HORAS[Math.floor(r() * HORAS.length)]
        if (usadas.has(hora)) continue
        usadas.add(hora)
        const pac = 1 + Math.floor(r() * pacientes.length)
        const c = {
          id: id++, paciente_id: pac, dentista_id: den.id, box_id: den.id,
          fecha, hora, motivo: motivos[Math.floor(r() * motivos.length)],
          estado: 'pendiente', confirmacion: 'pendiente', intentos_contacto: 0,
          observacion: '', llegada_en: null, atencion_en: null,
          creado_en: iso(sumarDias(fecha, -7), '09:00'),
        }
        if (d < 0) {
          const x = r()
          if (x < 0.1) c.estado = 'cancelada'
          else if (x < 0.19) { c.estado = 'no_asistio'; c.confirmacion = 'sin_respuesta' }
          else {
            c.estado = 'atendida'; c.confirmacion = 'confirmada'
            const lunesOTarde = dia === 1 || hora >= '16:00'
            const espera = 4 + Math.floor(r() * (lunesOTarde ? 28 : 14))
            c.llegada_en = iso(fecha, hora, -5)
            c.atencion_en = iso(fecha, hora, espera - 5)
            if (r() < 0.6 && pac !== 1) {
              procedimientos.push({
                id: procedimientos.length + 1, paciente_id: pac, dentista_id: den.id, cita_id: c.id, fecha,
                descripcion: { 1: ['Destartraje y profilaxis', 'Restauración con resina', 'Examen y radiografía'][Math.floor(r() * 3)], 2: 'Control y ajuste de ortodoncia', 3: 'Tratamiento de conducto (sesión)' }[den.id],
                indicaciones: 'Evitar alimentos duros por 24 horas.', pendientes: '', costo: [25000, 35000, 45000, 80000][Math.floor(r() * 4)],
              })
            }
          }
        } else {
          c.confirmacion = d <= 2 ? (r() < 0.5 ? 'confirmada' : 'pendiente') : 'pendiente'
          c.estado = c.confirmacion === 'confirmada' ? 'confirmada' : 'pendiente'
        }
        citas.push(c)
      }
    }
  }

  // Agenda de hoy con distintos estados para mostrar el flujo completo
  const deHoy = [
    [1, 1, '09:00', 'atendida', 'Control'], [3, 1, '10:00', 'en_atencion', 'Tapadura'],
    [4, 1, '11:00', 'presente', 'Limpieza'], [5, 1, '12:00', 'confirmada', 'Evaluación'],
    [6, 1, '15:00', 'pendiente', 'Dolor de muela'], [7, 2, '09:30', 'atendida', 'Ajuste de brackets'],
    [2, 2, '11:30', 'confirmada', 'Ajuste de brackets'], [8, 2, '16:00', 'pendiente', 'Control'],
    [9, 3, '10:30', 'presente', 'Tratamiento de conducto'], [10, 3, '14:30', 'confirmada', 'Tratamiento de conducto'],
  ]
  for (const [pac, den, hora, estado, motivo] of deHoy) {
    const c = {
      id: id++, paciente_id: pac, dentista_id: den, box_id: den, fecha: H, hora, motivo, estado,
      confirmacion: estado === 'pendiente' ? 'pendiente' : 'confirmada', intentos_contacto: 0,
      observacion: pac === 4 ? 'Llegó 10 minutos tarde.' : '', llegada_en: null, atencion_en: null,
      creado_en: iso(sumarDias(H, -5), '09:00'),
    }
    if (['presente', 'en_atencion', 'atendida'].includes(estado)) c.llegada_en = iso(H, hora, -4)
    if (['en_atencion', 'atendida'].includes(estado)) c.atencion_en = iso(H, hora, 6)
    citas.push(c)
  }
  // Próxima cita de Juan Pérez (paciente demo)
  citas.push({
    id: id++, paciente_id: 1, dentista_id: 2, box_id: 2, fecha: sumarDias(H, 3), hora: '10:00',
    motivo: 'Ajuste de brackets', estado: 'confirmada', confirmacion: 'confirmada', intentos_contacto: 0,
    observacion: '', llegada_en: null, atencion_en: null, creado_en: ahora.toISOString(),
  })

  // Historial clínico detallado de Juan Pérez
  diagnosticos.push(
    { id: 1, paciente_id: 1, dentista_id: 1, cita_id: null, fecha: sumarDias(H, -150), descripcion: 'Apiñamiento dentario anteroinferior. Caries incipiente en pieza 3.6.' },
    { id: 2, paciente_id: 1, dentista_id: 2, cita_id: null, fecha: sumarDias(H, -140), descripcion: 'Maloclusión clase II división 1. Se indica tratamiento de ortodoncia fija.' },
    { id: 3, paciente_id: 1, dentista_id: 1, cita_id: null, fecha: H, descripcion: 'Encías levemente inflamadas en sector anterior; higiene deficiente alrededor de brackets.' },
  )
  procedimientos.push(
    { id: procedimientos.length + 1, paciente_id: 1, dentista_id: 1, cita_id: null, fecha: sumarDias(H, -150), descripcion: 'Restauración con resina en pieza 3.6', indicaciones: 'No comer en 2 horas.', pendientes: 'Derivar a ortodoncia.', costo: 35000 },
    { id: procedimientos.length + 2, paciente_id: 1, dentista_id: 2, cita_id: null, fecha: sumarDias(H, -140), descripcion: 'Instalación de brackets metálicos superiores e inferiores', indicaciones: 'Dieta blanda por una semana. Usar cepillo interproximal.', pendientes: 'Controles mensuales de ajuste.', costo: 0 },
    { id: procedimientos.length + 3, paciente_id: 1, dentista_id: 1, cita_id: null, fecha: H, descripcion: 'Destartraje supragingival', indicaciones: 'Reforzar técnica de cepillado.', pendientes: 'Control en 3 meses.', costo: 25000 },
  )

  const tratamientos = [
    { id: 1, paciente_id: 1, descripcion: 'Ortodoncia fija completa', monto_total: 1200000, cuotas: 12, fecha_inicio: sumarMeses(H, -5), creado_en: iso(sumarMeses(H, -5), '10:00') },
    { id: 2, paciente_id: 9, descripcion: 'Endodoncia pieza 4.6 + corona', monto_total: 280000, cuotas: 4, fecha_inicio: sumarMeses(H, -2), creado_en: iso(sumarMeses(H, -2), '10:00') },
    { id: 3, paciente_id: 2, descripcion: 'Ortodoncia fija completa', monto_total: 1100000, cuotas: 10, fecha_inicio: sumarMeses(H, -3), creado_en: iso(sumarMeses(H, -3), '10:00') },
    { id: 4, paciente_id: 4, descripcion: 'Limpieza y blanqueamiento', monto_total: 90000, cuotas: 1, fecha_inicio: sumarDias(H, -10), creado_en: iso(sumarDias(H, -10), '10:00') },
    { id: 5, paciente_id: 6, descripcion: 'Restauraciones múltiples (3 piezas)', monto_total: 120000, cuotas: 3, fecha_inicio: sumarMeses(H, -1), creado_en: iso(sumarMeses(H, -1), '10:00') },
  ]
  const medios = ['Efectivo', 'Débito', 'Crédito', 'Transferencia']
  const pagos = []
  const pagar = (tid, pid, monto, fecha) => pagos.push({
    id: pagos.length + 1, tratamiento_id: tid, paciente_id: pid, monto, fecha,
    medio: medios[pagos.length % 4], registrado_por: 'Camila Torres',
  })
  for (let k = 0; k < 3; k++) pagar(1, 1, 100000, sumarMeses(H, -5 + k))
  pagar(2, 9, 70000, sumarMeses(H, -2))
  for (let k = 0; k < 4; k++) pagar(3, 2, 110000, sumarMeses(H, -3 + k))
  pagar(4, 4, 90000, sumarDias(H, -10))
  pagar(5, 6, 40000, sumarMeses(H, -1))
  pagar(5, 6, 40000, sumarDias(H, -2))

  const notificaciones = [
    { id: 1, para_rol: 'dentista', dentista_id: 1, paciente_id: 4, cita_id: null, tipo: 'llegada', mensaje: 'Fernanda Díaz llegó a recepción (cita 11:00, Box 1).', estado: 'enviada', creado_en: iso(H, '10:56') },
    { id: 2, para_rol: 'dentista', dentista_id: 3, paciente_id: 9, cita_id: null, tipo: 'llegada', mensaje: 'Diego Castillo llegó a recepción (cita 10:30, Box 3).', estado: 'enviada', creado_en: iso(H, '10:26') },
    { id: 3, para_rol: 'paciente', dentista_id: 2, paciente_id: 1, cita_id: null, tipo: 'recordatorio', mensaje: `Recordatorio: tiene una cita de Ajuste de brackets con Dr. Felipe Rojas el ${sumarDias(H, 3).split('-').reverse().join('/')} a las 10:00.`, estado: 'enviada', creado_en: ahora.toISOString() },
    { id: 4, para_rol: 'paciente', dentista_id: 2, paciente_id: 1, cita_id: null, tipo: 'cambio', mensaje: 'Su cita de control fue reprogramada por la clínica. Revise "Mis citas" para ver el nuevo horario.', estado: 'leida', creado_en: iso(sumarDias(H, -20), '15:10') },
    { id: 5, para_rol: 'recepcion', dentista_id: null, paciente_id: 6, cita_id: null, tipo: 'solicitud', mensaje: 'Constanza Vega solicitó una cita en línea para hoy a las 15:00.', estado: 'enviada', creado_en: iso(sumarDias(H, -1), '18:40') },
  ]

  const auditoria = [
    { id: 1, usuario: 'Dra. Carolina Muñoz', rol: 'dentista', accion: 'INSERT', tabla: 'diagnosticos', registro_id: 3, detalle: 'Nuevo diagnóstico para paciente #1', fecha: iso(H, '09:25') },
    { id: 2, usuario: 'Camila Torres', rol: 'recepcionista', accion: 'INSERT', tabla: 'pagos', registro_id: 10, detalle: 'Pago de $40.000 (tratamiento #5)', fecha: iso(sumarDias(H, -2), '12:14') },
    { id: 3, usuario: 'Camila Torres', rol: 'recepcionista', accion: 'UPDATE', tabla: 'citas', registro_id: 5, detalle: 'Cita reprogramada', fecha: iso(sumarDias(H, -20), '15:10') },
  ]

  return {
    fechaSemilla: H,
    dentistas, boxes, pacientes, citas, diagnosticos, procedimientos,
    tratamientos, pagos, notificaciones, auditoria,
  }
}

let datos = null

function cargar() {
  if (datos) return datos
  try {
    const guardado = JSON.parse(localStorage.getItem(KEY))
    if (guardado && guardado.fechaSemilla === hoy()) datos = guardado
  } catch { /* sin almacenamiento disponible */ }
  if (!datos) { datos = semilla(); guardar() }
  return datos
}

function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(datos)) } catch { /* ignorar */ }
}

export function reiniciarDemo() {
  datos = semilla()
  guardar()
}

const copia = (x) => JSON.parse(JSON.stringify(x))

export function listar(tabla, filtros = {}, orden, asc = true) {
  let filas = cargar()[tabla].filter((f) =>
    Object.entries(filtros).every(([k, v]) => f[k] === v))
  if (orden) {
    filas = [...filas].sort((a, b) => (a[orden] > b[orden] ? 1 : a[orden] < b[orden] ? -1 : 0) * (asc ? 1 : -1))
  }
  return copia(filas)
}

export function insertar(tabla, fila) {
  const t = cargar()[tabla]
  const nueva = { ...fila, id: (t.reduce((m, f) => Math.max(m, f.id), 0) || 0) + 1 }
  t.push(nueva)
  guardar()
  return copia(nueva)
}

export function actualizar(tabla, id, cambios) {
  const fila = cargar()[tabla].find((f) => f.id === id)
  if (!fila) throw new Error('Registro no encontrado')
  Object.assign(fila, cambios)
  guardar()
  return copia(fila)
}

export function ocupados(fecha) {
  return cargar().citas
    .filter((c) => c.fecha === fecha && c.estado !== 'cancelada')
    .map(({ dentista_id, box_id, hora }) => ({ dentista_id, box_id, hora }))
}

