create type public.fsp_source_type as enum ('kpi_period', 'action');
create type public.fsp_method_type as enum ('five_whys', 'ishikawa', 'structured_analysis');
create type public.fsp_status as enum ('aberta', 'em_analise', 'concluida', 'convertida_em_acao');

create table public.fsps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type public.fsp_source_type not null,
  source_id uuid not null,
  kpi_id uuid null references public.kpis(id) on delete set null,
  kpi_period_record_id uuid null references public.kpi_period_records(id) on delete set null,
  action_id uuid null references public.actions(id) on delete set null,
  title text not null,
  problem_statement text not null,
  impact text null,
  evidence text null,
  method_type public.fsp_method_type not null default 'structured_analysis',
  root_cause text null,
  probable_cause text null,
  recommendation text null,
  owner_id uuid null references public.profiles(id) on delete set null,
  status public.fsp_status not null default 'aberta',
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  linked_action_id uuid null references public.actions(id) on delete set null,
  generated_action_id uuid null references public.actions(id) on delete set null,
  why_1 text null,
  why_2 text null,
  why_3 text null,
  why_4 text null,
  why_5 text null,
  five_whys_conclusion text null,
  ishikawa_method text null,
  ishikawa_labor text null,
  ishikawa_machine text null,
  ishikawa_material text null,
  ishikawa_measurement text null,
  ishikawa_environment text null,
  ishikawa_additional_notes text null,
  ishikawa_conclusion text null,
  structured_observed_problem text null,
  structured_effect_impact text null,
  structured_cause_hypothesis text null,
  structured_evidence_notes text null,
  structured_probable_cause text null,
  structured_root_cause text null,
  structured_recommendation text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.actions
  add column if not exists fsp_id uuid null references public.fsps(id) on delete set null,
  add column if not exists kpi_id uuid null references public.kpis(id) on delete set null,
  add column if not exists kpi_period_record_id uuid null references public.kpi_period_records(id) on delete set null;

create index fsps_project_id_idx on public.fsps(project_id);
create index fsps_kpi_id_idx on public.fsps(kpi_id);
create index fsps_kpi_period_record_id_idx on public.fsps(kpi_period_record_id);
create index fsps_action_id_idx on public.fsps(action_id);
create index actions_fsp_id_idx on public.actions(fsp_id);

drop trigger if exists set_fsps_updated_at on public.fsps;
create trigger set_fsps_updated_at
before update on public.fsps
for each row execute function public.set_updated_at();

alter table public.fsps enable row level security;

create policy "fsps_internal_read"
on public.fsps
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
    where pr.id = fsps.project_id
  )
);

create policy "fsps_internal_write"
on public.fsps
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
    where pr.id = fsps.project_id
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
    where pr.id = fsps.project_id
  )
);
