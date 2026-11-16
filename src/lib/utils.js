// Funciones de apoyo usadas en varias pantallas.

// Bloques de atención de 30 minutos (colación de 13:00 a 14:00).
export const HORAS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
]

export const ROLES = {
  admin: 'Administración',
  recepcionista: 'Recepción',
  dentista: 'Dentista',
  asistente: 'Asistente dental',
  paciente: 'Paciente',
}

export const ESTADOS = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  presente: 'Paciente presente',
  en_atencion: 'En atención',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
}

// Fecha local en formato AAAA-MM-DD
export function fechaISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export const hoy = () => fechaISO()

export function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return fechaISO(d)
}

export function sumarMeses(fecha, meses) {
  const d = new Date(fecha + 'T12:00:00')
  d.setMonth(d.getMonth() + meses)
  return fechaISO(d)
}

export function fechaLarga(fecha) {
  const t = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export function fechaCorta(fecha) {
  if (!fecha) return '—'
  return new Date(fecha.length === 10 ? fecha + 'T12:00:00' : fecha)
    .toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function fechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export const pesos = (n) =>
  '$' + Math.round(n || 0).toLocaleString('es-CL')

// Validación simple de RUT chileno (formato 12345678-9)
export function rutValido(rut) {
  const limpio = rut.replace(/\./g, '').toUpperCase()
  if (!/^\d{7,8}-[\dK]$/.test(limpio)) return false
  const [num, dv] = limpio.split('-')
  let suma = 0, mul = 2
  for (let i = num.length - 1; i >= 0; i--) {
    suma += Number(num[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (suma % 11)
  const esperado = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  return dv === esperado
}

export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)

// Estado de pago de un tratamiento en cuotas.
export function estadoTratamiento(t, pagos) {
  const pagado = pagos
    .filter((p) => p.tratamiento_id === t.id)
    .reduce((s, p) => s + Number(p.monto), 0)
  const cuota = Math.round(t.monto_total / t.cuotas)
  let vencidas = 0
  for (let k = 0; k < t.cuotas; k++) {
    if (sumarMeses(t.fecha_inicio, k) < hoy()) vencidas++
  }
  const esperado = Math.min(t.monto_total, vencidas * cuota)
  return {
    pagado,
    saldo: Math.max(0, t.monto_total - pagado),
    cuota,
    cuotasPagadas: Math.min(t.cuotas, Math.floor(pagado / cuota)),
    atrasado: Math.max(0, esperado - pagado),
  }
}

export function minutosEntre(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 60000)
}

export const esFinDeSemana = (fecha) => [0, 6].includes(new Date(fecha + 'T12:00:00').getDay())

// Horarios libres de un dentista en una fecha: el dentista y al menos un box
// deben estar desocupados (evita los "cruces" de horas descritos en la entrevista).
export function horasLibres(fecha, dentistaId, ocupados, boxes) {
  if (esFinDeSemana(fecha) || fecha < hoy()) return []
  const ahora = new Date().toTimeString().slice(0, 5)
  return HORAS.filter((h) => !(fecha === hoy() && h <= ahora))
    .filter((h) => !ocupados.some((o) => o.hora === h && o.dentista_id === dentistaId))
    .map((h) => ({ hora: h, box: boxes.find((b) => b.activo && !ocupados.some((o) => o.hora === h && o.box_id === b.id)) }))
    .filter((x) => x.box)
}
