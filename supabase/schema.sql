-- =====================================================================
--  Sistema Clínica Dental "Sonrisa Norte" — Esquema Supabase (PostgreSQL)
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
--  Basado en el diagrama de clases del informe (Paciente, Dentista,
--  Recepcionista, Cita, Box, Pago, HistorialClinico, Diagnostico,
--  Procedimiento, Notificacion) + perfiles de usuario y auditoría.
-- =====================================================================

-- ---------- Tablas ----------
create table public.dentistas (
  id bigint generated always as identity primary key,
  nombre text not null,
  especialidad text not null,
  telefono text,
  correo text
);

create table public.boxes (
  id bigint generated always as identity primary key,
  nombre text not null,
  activo boolean not null default true
);

create table public.pacientes (
  id bigint generated always as identity primary key,
  rut text not null unique check (rut ~ '^[0-9]{7,8}-[0-9K]$'),
  nombre text not null,
  telefono text not null,
  correo text not null,
  direccion text,
  creado_en timestamptz not null default now()
);

-- Perfil de cada usuario autenticado (rol = control de acceso)
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('admin','recepcionista','dentista','asistente','paciente')),
  dentista_id bigint references public.dentistas(id),
  paciente_id bigint references public.pacientes(id)
);

create table public.citas (
  id bigint generated always as identity primary key,
  paciente_id bigint not null references public.pacientes(id),
  dentista_id bigint not null references public.dentistas(id),
  box_id bigint not null references public.boxes(id),
  fecha date not null,
  hora text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  motivo text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','presente','en_atencion','atendida','cancelada','no_asistio')),
  confirmacion text not null default 'pendiente' check (confirmacion in ('pendiente','confirmada','sin_respuesta')),
  intentos_contacto int not null default 0,
  observacion text default '',
  llegada_en timestamptz,
  atencion_en timestamptz,
  creado_en timestamptz not null default now()
);
-- Evita cruces: un dentista o un box no puede tener dos citas activas a la misma hora
create unique index citas_dentista_unica on public.citas (dentista_id, fecha, hora)
  where estado not in ('cancelada');
create unique index citas_box_unica on public.citas (box_id, fecha, hora)
  where estado not in ('cancelada');

create table public.diagnosticos (
  id bigint generated always as identity primary key,
  paciente_id bigint not null references public.pacientes(id),
  dentista_id bigint not null references public.dentistas(id),
  cita_id bigint references public.citas(id),
  fecha date not null default current_date,
  descripcion text not null
);

create table public.procedimientos (
  id bigint generated always as identity primary key,
  paciente_id bigint not null references public.pacientes(id),
  dentista_id bigint not null references public.dentistas(id),
  cita_id bigint references public.citas(id),
  fecha date not null default current_date,
  descripcion text not null,
  indicaciones text,
  pendientes text,
  costo int default 0 check (costo >= 0)
);

create table public.tratamientos (
  id bigint generated always as identity primary key,
  paciente_id bigint not null references public.pacientes(id),
  descripcion text not null,
  monto_total int not null check (monto_total > 0),
  cuotas int not null default 1 check (cuotas between 1 and 36),
  fecha_inicio date not null default current_date,
  creado_en timestamptz not null default now()
);

create table public.pagos (
  id bigint generated always as identity primary key,
  tratamiento_id bigint not null references public.tratamientos(id),
  paciente_id bigint not null references public.pacientes(id),
  monto int not null check (monto > 0),
  fecha date not null default current_date,
  medio text not null,
  registrado_por text
);

create table public.notificaciones (
  id bigint generated always as identity primary key,
  para_rol text not null check (para_rol in ('paciente','dentista','recepcion')),
  paciente_id bigint references public.pacientes(id),
  dentista_id bigint references public.dentistas(id),
  cita_id bigint references public.citas(id),
  tipo text not null,
  mensaje text not null,
  estado text not null default 'enviada' check (estado in ('enviada','leida','error')),
  creado_en timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  usuario text,
  rol text,
  accion text not null,
  tabla text not null,
  registro_id bigint,
  detalle text,
  fecha timestamptz not null default now()
);

-- ---------- Funciones de apoyo para seguridad ----------
create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.mi_paciente_id() returns bigint
language sql stable security definer set search_path = public as $$
  select paciente_id from public.perfiles where id = auth.uid()
$$;

create or replace function public.mi_dentista_id() returns bigint
language sql stable security definer set search_path = public as $$
  select dentista_id from public.perfiles where id = auth.uid()
$$;

-- Horarios ocupados de un día SIN datos personales (lo usa el paciente al pedir hora)
create or replace function public.horarios_ocupados(p_fecha date)
returns table (dentista_id bigint, box_id bigint, hora text)
language sql stable security definer set search_path = public as $$
  select c.dentista_id, c.box_id, c.hora from public.citas c
  where c.fecha = p_fecha and c.estado <> 'cancelada'
$$;

-- Al registrarse un paciente en la web se crea su ficha y su perfil.
-- El rol se fija SIEMPRE en 'paciente' (no se confía en datos del navegador).
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid bigint;
begin
  if new.raw_user_meta_data ? 'rut' then
    insert into public.pacientes (rut, nombre, telefono, correo, direccion)
    values (new.raw_user_meta_data->>'rut', new.raw_user_meta_data->>'nombre',
            new.raw_user_meta_data->>'telefono', new.email, new.raw_user_meta_data->>'direccion')
    on conflict (rut) do update set correo = excluded.correo
    returning id into pid;
    insert into public.perfiles (id, email, nombre, rol, paciente_id)
    values (new.id, new.email, new.raw_user_meta_data->>'nombre', 'paciente', pid);
  end if;
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Auditoría automática (RNF-04 / RNF-05): quién, qué y cuándo
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.perfiles;
begin
  select * into p from public.perfiles where id = auth.uid();
  insert into public.auditoria (usuario, rol, accion, tabla, registro_id, detalle)
  values (coalesce(p.nombre, 'sistema'), p.rol, tg_op, tg_table_name, new.id,
          case when tg_op = 'UPDATE' then 'Antes: ' || left(row_to_json(old)::text, 300) else left(row_to_json(new)::text, 300) end);
  return new;
end $$;

create trigger aud_citas after insert or update on public.citas for each row execute function public.registrar_auditoria();
create trigger aud_diag after insert or update on public.diagnosticos for each row execute function public.registrar_auditoria();
create trigger aud_proc after insert or update on public.procedimientos for each row execute function public.registrar_auditoria();
create trigger aud_trat after insert or update on public.tratamientos for each row execute function public.registrar_auditoria();
create trigger aud_pagos after insert or update on public.pagos for each row execute function public.registrar_auditoria();
create trigger aud_pac after insert or update on public.pacientes for each row execute function public.registrar_auditoria();

-- ---------- Row Level Security (RNF-01, RNF-02, RNF-03) ----------
alter table public.dentistas enable row level security;
alter table public.boxes enable row level security;
alter table public.pacientes enable row level security;
alter table public.perfiles enable row level security;
alter table public.citas enable row level security;
alter table public.diagnosticos enable row level security;
alter table public.procedimientos enable row level security;
alter table public.tratamientos enable row level security;
alter table public.pagos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.auditoria enable row level security;

-- Catálogos: cualquier usuario autenticado puede leerlos
create policy cat_dentistas on public.dentistas for select to authenticated using (true);
create policy cat_boxes on public.boxes for select to authenticated using (true);
create policy admin_dentistas on public.dentistas for all to authenticated using (rol_actual() = 'admin') with check (rol_actual() = 'admin');
create policy admin_boxes on public.boxes for all to authenticated using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

-- Perfiles: cada uno ve el suyo; admin ve todos
create policy perfil_propio on public.perfiles for select to authenticated using (id = auth.uid() or rol_actual() = 'admin');

-- Pacientes: personal ve todos; el paciente solo su ficha
create policy pac_personal on public.pacientes for select to authenticated
  using (rol_actual() in ('admin','recepcionista','dentista','asistente') or id = mi_paciente_id());
create policy pac_registro on public.pacientes for insert to authenticated with check (rol_actual() in ('admin','recepcionista'));
create policy pac_editar on public.pacientes for update to authenticated using (rol_actual() in ('admin','recepcionista'));

-- Citas
create policy citas_ver on public.citas for select to authenticated using (
  rol_actual() in ('admin','recepcionista','asistente')
  or (rol_actual() = 'dentista' and dentista_id = mi_dentista_id())
  or paciente_id = mi_paciente_id());
create policy citas_crear on public.citas for insert to authenticated with check (
  rol_actual() in ('admin','recepcionista') or (rol_actual() = 'paciente' and paciente_id = mi_paciente_id()));
create policy citas_editar on public.citas for update to authenticated using (
  rol_actual() in ('admin','recepcionista')
  or (rol_actual() = 'dentista' and dentista_id = mi_dentista_id())
  or (rol_actual() = 'paciente' and paciente_id = mi_paciente_id()));

-- Información clínica: solo dentistas (escriben) y administración (consulta)
create policy diag_ver on public.diagnosticos for select to authenticated using (rol_actual() in ('admin','dentista'));
create policy diag_crear on public.diagnosticos for insert to authenticated with check (rol_actual() = 'dentista' and dentista_id = mi_dentista_id());
create policy proc_ver on public.procedimientos for select to authenticated using (rol_actual() in ('admin','dentista'));
create policy proc_crear on public.procedimientos for insert to authenticated with check (rol_actual() = 'dentista' and dentista_id = mi_dentista_id());

-- Información financiera: solo recepción y administración
create policy trat_ver on public.tratamientos for select to authenticated using (rol_actual() in ('admin','recepcionista'));
create policy trat_crear on public.tratamientos for insert to authenticated with check (rol_actual() in ('admin','recepcionista'));
create policy pagos_ver on public.pagos for select to authenticated using (rol_actual() in ('admin','recepcionista'));
create policy pagos_crear on public.pagos for insert to authenticated with check (rol_actual() in ('admin','recepcionista'));

-- Notificaciones: cada rol ve las suyas; el personal puede generarlas
create policy notif_ver on public.notificaciones for select to authenticated using (
  rol_actual() in ('admin','recepcionista')
  or (para_rol = 'dentista' and (dentista_id = mi_dentista_id() or rol_actual() = 'asistente'))
  or (para_rol = 'paciente' and paciente_id = mi_paciente_id()));
create policy notif_crear on public.notificaciones for insert to authenticated with check (
  rol_actual() in ('admin','recepcionista','dentista')
  or (rol_actual() = 'paciente' and paciente_id = mi_paciente_id()));
create policy notif_leer on public.notificaciones for update to authenticated using (
  rol_actual() = 'admin'
  or (para_rol = 'recepcion' and rol_actual() = 'recepcionista')
  or (para_rol = 'dentista' and dentista_id = mi_dentista_id())
  or (para_rol = 'paciente' and paciente_id = mi_paciente_id()));

-- Auditoría: solo lectura para administración (nadie puede editarla desde la app)
create policy aud_ver on public.auditoria for select to authenticated using (rol_actual() = 'admin');
