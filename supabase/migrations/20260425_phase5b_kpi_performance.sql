create type public.kpi_reading_type as enum ('higher_is_better', 'lower_is_better', 'exact_target');
create type public.performance_status as enum ('green', 'yellow', 'red');
create type public.kpi_period_record_status as enum ('aberto', 'fechado', 'revisado');

alter table public.kpis
  add column if not exists reading_type public.kpi_reading_type not null default 'higher_is_better';

create table public.kpi_target_periods (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  period_label text not null,
  start_date date not null,
  end_date date not null,
  planned_target numeric not null,
  green_threshold numeric not null,
  yellow_threshold numeric not null,
  red_threshold numeric not null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpi_target_periods_date_range check (start_date <= end_date)
);

create table public.kpi_period_records (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  target_period_id uuid not null unique references public.kpi_target_periods(id) on delete cascade,
  competence text not null,
  actual_value numeric not null,
  calculated_status public.performance_status not null,
  absolute_deviation numeric not null,
  percentage_deviation numeric null,
  justification text null,
  short_analysis text null,
  recorded_by uuid null references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  period_status public.kpi_period_record_status not null default 'aberto',
  updated_at timestamptz not null default now()
);

create index kpi_target_periods_kpi_id_idx on public.kpi_target_periods(kpi_id);
create index kpi_period_records_kpi_id_idx on public.kpi_period_records(kpi_id);

drop trigger if exists set_kpi_target_periods_updated_at on public.kpi_target_periods;
create trigger set_kpi_target_periods_updated_at
before update on public.kpi_target_periods
for each row execute function public.set_updated_at();

drop trigger if exists set_kpi_period_records_updated_at on public.kpi_period_records;
create trigger set_kpi_period_records_updated_at
before update on public.kpi_period_records
for each row execute function public.set_updated_at();

alter table public.kpi_target_periods enable row level security;
alter table public.kpi_period_records enable row level security;

create policy "kpi_target_periods_internal_read"
on public.kpi_target_periods
for select
using (
  exists (
    select 1
    from public.kpis k
    where k.id = kpi_target_periods.kpi_id
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

create policy "kpi_target_periods_internal_write"
on public.kpi_target_periods
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.kpis k
    where k.id = kpi_target_periods.kpi_id
  )
);

create policy "kpi_period_records_internal_read"
on public.kpi_period_records
for select
using (
  exists (
    select 1
    from public.kpis k
    where k.id = kpi_period_records.kpi_id
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

create policy "kpi_period_records_internal_write"
on public.kpi_period_records
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.kpis k
    where k.id = kpi_period_records.kpi_id
  )
);
