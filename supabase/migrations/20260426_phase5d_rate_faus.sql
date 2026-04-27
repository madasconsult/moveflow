create type public.rate_profile_type as enum ('distribuidor', 'industria', 'operador_logistico');

create table public.rate_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  diagnosis_id uuid not null unique references public.project_diagnoses(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rate_assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.rate_assessments(id) on delete cascade,
  version_number integer not null,
  version_name text not null,
  assessment_date date not null default current_date,
  profile_type public.rate_profile_type not null,
  overall_score numeric null,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_assessment_versions_unique unique (assessment_id, version_number)
);

create table public.rate_assessment_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.rate_assessment_versions(id) on delete cascade,
  axis text not null,
  criterion text not null,
  weight numeric not null check (weight >= 0),
  score numeric null check (score is null or (score >= 0 and score <= 5)),
  weighted_score numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_assessment_items_unique unique (version_id, axis, criterion)
);

create index rate_assessments_project_id_idx on public.rate_assessments(project_id);
create index rate_assessments_diagnosis_id_idx on public.rate_assessments(diagnosis_id);
create index rate_assessment_versions_assessment_id_idx on public.rate_assessment_versions(assessment_id);
create index rate_assessment_items_version_id_idx on public.rate_assessment_items(version_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rate_assessments_updated_at on public.rate_assessments;
create trigger set_rate_assessments_updated_at
before update on public.rate_assessments
for each row execute function public.set_updated_at();

drop trigger if exists set_rate_assessment_versions_updated_at on public.rate_assessment_versions;
create trigger set_rate_assessment_versions_updated_at
before update on public.rate_assessment_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_rate_assessment_items_updated_at on public.rate_assessment_items;
create trigger set_rate_assessment_items_updated_at
before update on public.rate_assessment_items
for each row execute function public.set_updated_at();

alter table public.rate_assessments enable row level security;
alter table public.rate_assessment_versions enable row level security;
alter table public.rate_assessment_items enable row level security;

create policy "rate_assessments_internal_read"
on public.rate_assessments
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
    where pr.id = rate_assessments.project_id
  )
);

create policy "rate_assessments_internal_write"
on public.rate_assessments
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
    where pr.id = rate_assessments.project_id
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
    where pr.id = rate_assessments.project_id
  )
);

create policy "rate_assessment_versions_internal_read"
on public.rate_assessment_versions
for select
using (
  exists (
    select 1
    from public.rate_assessments ra
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

create policy "rate_assessment_versions_internal_write"
on public.rate_assessment_versions
for all
using (
  exists (
    select 1
    from public.rate_assessments ra
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.rate_assessments ra
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

create policy "rate_assessment_items_internal_read"
on public.rate_assessment_items
for select
using (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

create policy "rate_assessment_items_internal_write"
on public.rate_assessment_items
for all
using (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);
