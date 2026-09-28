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
