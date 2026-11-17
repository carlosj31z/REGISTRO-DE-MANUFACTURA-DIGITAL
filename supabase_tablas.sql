-- Tablas de Status RMD (index.html) y Seguimiento RMD. Ejecutar una vez en el SQL Editor del proyecto de Supabase.
-- Se puede volver a ejecutar sin problema: no borra datos.

create table if not exists public.rmd_dashboard_kv (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

alter table public.rmd_dashboard_kv enable row level security;

drop policy if exists "Acceso con clave anon" on public.rmd_dashboard_kv;
create policy "Acceso con clave anon"
  on public.rmd_dashboard_kv
  for all
  using (true)
  with check (true);

create table if not exists public.rmd_seguimiento (
  descripcion text primary key,
  planta text,
  seccion text,
  version int,
  estado text,
  etapa text,
  prioridad text,
  actualizado boolean default false,
  motivo text,
  motivo_manual boolean default false,
  sub_motivo_produccion text,
  sub_motivo_produccion_manual boolean default false,
  codigo_cc text,
  fecha_recepcion_borrador date,
  fecha_ingreso_sap date,
  fecha_ingreso_sap_manual boolean default false,
  responsable_doc text,
  estatus_ingreso text,
  estatus_ingreso_manual boolean default false,
  status_autorizacion text,
  status_autorizacion_manual boolean default false,
  estatus_caracterizacion text,
  fecha_caracterizacion date,
  historial_estatus_caracterizacion jsonb,
  observacion_adicional text,
  historial jsonb,
  updated_at timestamptz default now()
);

alter table public.rmd_seguimiento enable row level security;

drop policy if exists "Acceso con clave anon" on public.rmd_seguimiento;
create policy "Acceso con clave anon"
  on public.rmd_seguimiento
  for all
  using (true)
  with check (true);

-- Sincronización en tiempo real entre dispositivos (solo la tabla principal)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rmd_dashboard_kv') then
    alter publication supabase_realtime add table public.rmd_dashboard_kv;
  end if;
end $$;

-- ===== Asistente de configuraciones (chatbot): /chatbot/, api/chatbot.js, api/whatsapp.js =====
-- Solicitudes que deja el asistente. Estados: nueva (para el analista) → lista (para el ejecutor) → ejecutando →
-- ejecutada | revisar; además rechazada y resuelta. El ejecutor (AUTOMATIZACION-DE-RMD, `rmd-automation solicitudes
-- atender`) toma las «lista».
create table if not exists public.chatbot_solicitudes (
  id bigserial primary key,
  creado timestamptz default now(),
  canal text,                 -- web | whatsapp
  contacto text,              -- web:<id> | wa:<número>
  nombre text,
  area text,
  tipo text,                  -- cambio | consulta | incidencia
  prioridad text default 'normal',
  resumen text,
  rmd text,
  producto text,
  etapa text,
  planta text,
  op_lote text,
  detalle text,
  cambios jsonb default '[]'::jsonb,
  automatica boolean default false,
  estado text default 'nueva',
  respuesta_analista text,
  aprobado_por text,
  aprobado_en timestamptz,
  ejecucion_inicio timestamptz,
  ejecutado_en timestamptz,
  ejecutado_por text,
  resultado text,
  conversacion text
);
create index if not exists chatbot_solicitudes_estado on public.chatbot_solicitudes (estado);
create index if not exists chatbot_solicitudes_contacto on public.chatbot_solicitudes (contacto);

-- Conversación completa de cada contacto (solo se agregan mensajes al final).
create table if not exists public.chatbot_conversaciones (
  contacto text primary key,
  huella text,
  mensajes jsonb default '[]'::jsonb,
  actualizado timestamptz default now()
);

-- Ids de mensajes de WhatsApp ya atendidos (Meta a veces reenvía el mismo).
create table if not exists public.chatbot_mensajes_vistos (
  id text primary key,
  visto timestamptz default now()
);

alter table public.chatbot_solicitudes enable row level security;
alter table public.chatbot_conversaciones enable row level security;
alter table public.chatbot_mensajes_vistos enable row level security;
drop policy if exists "Acceso con clave anon" on public.chatbot_solicitudes;
create policy "Acceso con clave anon" on public.chatbot_solicitudes for all using (true) with check (true);
drop policy if exists "Acceso con clave anon" on public.chatbot_conversaciones;
create policy "Acceso con clave anon" on public.chatbot_conversaciones for all using (true) with check (true);
drop policy if exists "Acceso con clave anon" on public.chatbot_mensajes_vistos;
create policy "Acceso con clave anon" on public.chatbot_mensajes_vistos for all using (true) with check (true);
