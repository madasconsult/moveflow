create type public.diagnosis_status as enum ('em_elaboracao', 'concluido', 'revisado');
create type public.kpi_origin_type as enum ('diagnostic', 'project_defined', 'operational_unfolding', 'other');

create table public.project_diagnoses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  start_date date null,
  end_date date null,
  owner_id uuid null references public.profiles(id) on delete set null,
  executive_summary text null,
  key_findings text null,
  initial_hypotheses text null,
  status public.diagnosis_status not null default 'em_elaboracao',
  visible_to_client boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_diagnoses_release_guard check (
    not visible_to_client or status in ('concluido', 'revisado')
  )
);

create table public.diagnosis_indicators (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.project_diagnoses(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  area text not null,
  indicator_name text not null,
  unit_of_measure text null,
  baseline_value numeric null,
  rationale text null,
  notes text null,
  reference_date date null,
  priority public.action_priority not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diagnosis_indicators_project_id_idx on public.diagnosis_indicators(project_id);
create index diagnosis_indicators_diagnosis_id_idx on public.diagnosis_indicators(diagnosis_id);

alter table public.kpis
  add column if not exists origin_type public.kpi_origin_type not null default 'project_defined',
  add column if not exists diagnosis_indicator_id uuid null references public.diagnosis_indicators(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_project_diagnoses_updated_at on public.project_diagnoses;
create trigger set_project_diagnoses_updated_at
before update on public.project_diagnoses
for each row execute function public.set_updated_at();

drop trigger if exists set_diagnosis_indicators_updated_at on public.diagnosis_indicators;
create trigger set_diagnosis_indicators_updated_at
before update on public.diagnosis_indicators
for each row execute function public.set_updated_at();

alter table public.project_diagnoses enable row level security;
alter table public.diagnosis_indicators enable row level security;

create policy "project_diagnoses_internal_read"
on public.project_diagnoses
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_diagnoses.project_id
  )
);

create policy "project_diagnoses_internal_write"
on public.project_diagnoses
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_diagnoses.project_id
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
    from public.projects pr
    where pr.id = project_diagnoses.project_id
  )
);

create policy "project_diagnoses_client_read_released"
on public.project_diagnoses
for select
using (
  visible_to_client = true
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.client_id = p.client_id
    where p.id = auth.uid()
      and p.role = 'cliente'
      and p.is_active = true
      and pr.id = project_diagnoses.project_id
  )
);

create policy "diagnosis_indicators_internal_read"
on public.diagnosis_indicators
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = diagnosis_indicators.project_id
  )
);

create policy "diagnosis_indicators_internal_write"
on public.diagnosis_indicators
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = diagnosis_indicators.project_id
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
    from public.projects pr
    where pr.id = diagnosis_indicators.project_id
  )
);

create policy "diagnosis_indicators_client_read_released"
on public.diagnosis_indicators
for select
using (
  exists (
    select 1
    from public.project_diagnoses d
    join public.profiles p on p.id = auth.uid()
    join public.projects pr on pr.client_id = p.client_id
    where d.id = diagnosis_indicators.diagnosis_id
      and d.visible_to_client = true
      and p.role = 'cliente'
      and p.is_active = true
      and pr.id = diagnosis_indicators.project_id
  )
);
