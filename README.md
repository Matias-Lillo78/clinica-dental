# Sonrisa Norte — Sistema de gestión para clínica dental

Prototipo funcional (EV-03, Ingeniería de Software) construido con el stack indicado:
**VS Code + IA · Node.js/npm · React + JavaScript · Vite · Git/GitHub · Supabase (PostgreSQL + Auth) · Vercel**.

## Roles incluidos

| Rol | Pantallas | Restricciones |
|---|---|---|
| Paciente | Mis citas, Solicitar cita, Notificaciones | Solo ve sus citas; no ve información clínica ni financiera |
| Recepcionista | Agenda del día, Disponibilidad, Registrar cita, Pacientes, Pagos y deudas, Notificaciones | No ve historial clínico |
| Dentista | Mi agenda, Historial clínico, Notificaciones | Solo ve sus citas; no ve pagos |
| Asistente dental | Agenda del día (solo lectura), Notificaciones | No ve historial clínico ni pagos |
| Administración (dueña) | Reportes, Auditoría y todos los módulos | Historial clínico en modo consulta |

## Ejecutar en local

```bash
npm install
npm run dev
```

Sin variables de entorno la app funciona en **modo demostración** (datos de ejemplo en el navegador).
Usuarios de prueba (contraseña `Demo1234`): `admin@clinica.cl`, `recepcion@clinica.cl`,
`dentista@clinica.cl`, `ortodoncia@clinica.cl`, `asistente@clinica.cl`, `paciente@clinica.cl`.

## Conectar con Supabase

1. Crear un proyecto en https://supabase.com.
2. En **SQL Editor** ejecutar `supabase/schema.sql` (tablas, RLS por rol, triggers de auditoría).
3. En **Authentication > Users** crear los usuarios del personal (admin, recepción, dentistas, asistente).
4. Ejecutar `supabase/seed.sql` (dentistas, box, pacientes y asignación de roles).
5. (Opcional) En **Authentication > Providers > Email** desactivar "Confirm email" para pruebas.
6. Copiar `.env.example` como `.env` y completar con **Project Settings > API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Subir a GitHub y publicar en Vercel

```bash
git init
git add .
git commit -m "Prototipo clínica dental"
git branch -M main
git remote add origin https://github.com/USUARIO/clinica-dental.git
git push -u origin main
```

En https://vercel.com: **Add New > Project**, importar el repositorio (Vercel detecta Vite),
agregar las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y presionar **Deploy**.
Cada `git push` vuelve a publicar automáticamente.

## Estructura

```
src/lib/supabase.js   conexión con Supabase
src/lib/db.js         capa de datos (Supabase o modo demo) + autenticación
src/lib/demo.js       datos de ejemplo
src/lib/utils.js      horarios, validaciones (RUT, correo), cálculo de cuotas
src/pages/            pantallas por rol (paciente, recepcion, dentista, admin)
supabase/schema.sql   base de datos, políticas RLS y auditoría
```
