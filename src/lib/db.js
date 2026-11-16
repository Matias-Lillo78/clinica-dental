// Capa de datos: todas las pantallas usan estas funciones.
// Con Supabase configurado se consulta PostgreSQL (con políticas RLS por rol);
// si no, se usan los datos de demostración.
import { supabase, usaSupabase } from './supabase'
import * as demo from './demo'

// Tablas cuyos cambios quedan registrados en la auditoría (RNF-04 y RNF-05).
// En Supabase esto lo hace un trigger en la base de datos.
const AUDITADAS = ['citas', 'diagnosticos', 'procedimientos', 'pagos', 'tratamientos', 'pacientes']

let usuarioActual = null

function auditarDemo(accion, tabla, fila, detalle) {
  if (!AUDITADAS.includes(tabla) || !usuarioActual) return
  demo.insertar('auditoria', {
    usuario: usuarioActual.nombre, rol: usuarioActual.rol, accion, tabla,
    registro_id: fila.id, detalle, fecha: new Date().toISOString(),
  })
}

export async function listar(tabla, { filtros = {}, orden, asc = true } = {}) {
  if (!usaSupabase) return demo.listar(tabla, filtros, orden, asc)
  let q = supabase.from(tabla).select('*')
  for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v)
  if (orden) q = q.order(orden, { ascending: asc })
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function insertar(tabla, fila, detalle = '') {
  if (!usaSupabase) {
    const nueva = demo.insertar(tabla, fila)
    auditarDemo('INSERT', tabla, nueva, detalle)
    return nueva
  }
  const { data, error } = await supabase.from(tabla).insert(fila).select().single()
  if (error) throw error
  return data
}

export async function actualizar(tabla, id, cambios, detalle = '') {
  if (!usaSupabase) {
    const fila = demo.actualizar(tabla, id, cambios)
    auditarDemo('UPDATE', tabla, fila, detalle)
    return fila
  }
  const { data, error } = await supabase.from(tabla).update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Horarios ocupados de una fecha (sin exponer datos de otros pacientes).
export async function ocupados(fecha) {
  if (!usaSupabase) return demo.ocupados(fecha)
  const { data, error } = await supabase.rpc('horarios_ocupados', { p_fecha: fecha })
  if (error) throw error
  return data
}

// Crea una notificación interna (paciente, dentista o recepción).
// (Se inserta sin leer la fila de vuelta: quien envía no siempre puede verla por RLS.)
export async function notificar({ para_rol, paciente_id = null, dentista_id = null, cita_id = null, tipo, mensaje }) {
  const fila = { para_rol, paciente_id, dentista_id, cita_id, tipo, mensaje, estado: 'enviada', creado_en: new Date().toISOString() }
  if (!usaSupabase) return demo.insertar('notificaciones', fila)
  const { error } = await supabase.from('notificaciones').insert(fila)
  if (error) throw error
}

// ---------- Autenticación ----------

export async function iniciarSesion(email, clave) {
  if (!usaSupabase) {
    const u = demo.USUARIOS_DEMO.find((x) => x.email === email.trim().toLowerCase())
    if (!u || clave !== (u.clave || demo.CLAVE_DEMO)) throw new Error('Correo o contraseña incorrectos.')
    usuarioActual = u
    try { sessionStorage.setItem('demo-sesion', u.email) } catch { /* sin almacenamiento */ }
    return u
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave })
  if (error) throw new Error('Correo o contraseña incorrectos.')
  return cargarPerfil(data.user.id)
}

async function cargarPerfil(uid) {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', uid).single()
  if (error) throw error
  usuarioActual = data
  return data
}

export async function sesionGuardada() {
  if (!usaSupabase) {
    let email = null
    try { email = sessionStorage.getItem('demo-sesion') } catch { /* sin almacenamiento */ }
    usuarioActual = demo.USUARIOS_DEMO.find((x) => x.email === email) || null
    return usuarioActual
  }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  return cargarPerfil(data.session.user.id)
}

export async function cerrarSesion() {
  usuarioActual = null
  try { sessionStorage.removeItem('demo-sesion') } catch { /* sin almacenamiento */ }
  if (usaSupabase) await supabase.auth.signOut()
}

// Registro de pacientes desde la web. El rol siempre queda como "paciente"
// (lo fija un trigger en la base de datos, no el navegador).
export async function registrarCuentaPaciente({ rut, nombre, telefono, correo, direccion, clave }) {
  if (!usaSupabase) {
    const p = demo.insertar('pacientes', { rut, nombre, telefono, correo, direccion, creado_en: new Date().toISOString() })
    const u = { id: 'u-' + p.id, email: correo, nombre, rol: 'paciente', paciente_id: p.id, clave }
    demo.USUARIOS_DEMO.push(u)
    return u
  }
  const { error } = await supabase.auth.signUp({
    email: correo, password: clave,
    options: { data: { rut, nombre, telefono, direccion } },
  })
  if (error) throw error
  return null
}

export const modoDemo = !usaSupabase
export const reiniciarDemo = demo.reiniciarDemo
export const usuariosDemo = demo.USUARIOS_DEMO
export const claveDemo = demo.CLAVE_DEMO
