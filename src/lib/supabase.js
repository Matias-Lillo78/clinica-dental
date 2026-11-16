// Conexión con Supabase (backend + PostgreSQL + autenticación).
// Si las variables de entorno no están definidas, la app funciona en
// "modo demostración" con datos de ejemplo guardados en el navegador.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const usaSupabase = Boolean(url && key)
export const supabase = usaSupabase ? createClient(url, key) : null
