-- Datos iniciales (ejecutar después de schema.sql)
insert into public.dentistas (nombre, especialidad, telefono, correo) values
  ('Dra. Carolina Muñoz', 'Odontología general', '+56 9 6123 4501', 'dentista@clinica.cl'),
  ('Dr. Felipe Rojas', 'Ortodoncia', '+56 9 6123 4502', 'ortodoncia@clinica.cl'),
  ('Dra. Valentina Soto', 'Endodoncia', '+56 9 6123 4503', 'vsoto@clinica.cl');

insert into public.boxes (nombre) values ('Box 1'), ('Box 2'), ('Box 3');

insert into public.pacientes (rut, nombre, telefono, correo, direccion) values
  ('15234567-4', 'Juan Pérez', '+56 9 7100 4200', 'paciente@clinica.cl', 'Av. Arica 1450, Arica'),
  ('15966478-3', 'María González', '+56 9 7137 4313', 'maria.gonzalez@correo.cl', 'Calle Baquedano 720, Iquique');

-- USUARIOS DEL PERSONAL
-- 1) Créelos en Supabase > Authentication > Users > Add user (con contraseña).
-- 2) Luego asigne su rol reemplazando los correos si usó otros:
insert into public.perfiles (id, email, nombre, rol, dentista_id)
select id, email, 'Patricia Lagos', 'admin', null::bigint from auth.users where email = 'admin@clinica.cl'
union all
select id, email, 'Camila Torres', 'recepcionista', null from auth.users where email = 'recepcion@clinica.cl'
union all
select id, email, 'Dra. Carolina Muñoz', 'dentista', 1 from auth.users where email = 'dentista@clinica.cl'
union all
select id, email, 'Dr. Felipe Rojas', 'dentista', 2 from auth.users where email = 'ortodoncia@clinica.cl'
union all
select id, email, 'Javiera Pinto', 'asistente', null from auth.users where email = 'asistente@clinica.cl';
