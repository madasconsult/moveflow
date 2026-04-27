create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid null,
  project_id uuid null references public.projects(id) on delete set null,
  diagnosis_id uuid null references public.project_diagnoses(id) on delete set null,
  performed_by uuid null references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_event_type_idx on public.audit_logs(event_type);
create index if not exists audit_logs_project_id_idx on public.audit_logs(project_id);
create index if not exists audit_logs_diagnosis_id_idx on public.audit_logs(diagnosis_id);
create index if not exists audit_logs_performed_by_idx on public.audit_logs(performed_by);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_internal_read" on public.audit_logs;
create policy "audit_logs_internal_read"
on public.audit_logs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
);

drop policy if exists "audit_logs_admin_write" on public.audit_logs;
create policy "audit_logs_admin_write"
on public.audit_logs
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin_faus'
      and p.is_active = true
  )
);

create or replace function public.reset_rate_assessment(p_assessment_id uuid)
returns table (
  assessment_id uuid,
  project_id uuid,
  diagnosis_id uuid,
  versions_deleted integer,
  items_deleted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assessment public.rate_assessments%rowtype;
  v_versions_deleted integer := 0;
  v_items_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'admin_faus'
      and p.is_active = true
  ) then
    raise exception 'Apenas admin_faus pode resetar o Rate FAUS.';
  end if;

  select *
  into v_assessment
  from public.rate_assessments
  where id = p_assessment_id;

  if not found then
    raise exception 'Rate FAUS não encontrado.';
  end if;

  select count(*)
  into v_versions_deleted
  from public.rate_assessment_versions
  where assessment_id = p_assessment_id;

  select count(*)
  into v_items_deleted
  from public.rate_assessment_items rai
  where rai.version_id in (
    select rv.id
    from public.rate_assessment_versions rv
    where rv.assessment_id = p_assessment_id
  );

  insert into public.audit_logs (
    event_type,
    entity_type,
    entity_id,
    project_id,
    diagnosis_id,
    performed_by,
    payload
  )
  values (
    'rate_faus_reset',
    'rate_assessment',
    p_assessment_id,
    v_assessment.project_id,
    v_assessment.diagnosis_id,
    v_user_id,
    jsonb_build_object(
      'assessment_id', p_assessment_id,
      'versions_deleted', v_versions_deleted,
      'items_deleted', v_items_deleted
    )
  );

  delete from public.rate_assessments
  where id = p_assessment_id;

  return query
  select
    p_assessment_id,
    v_assessment.project_id,
    v_assessment.diagnosis_id,
    v_versions_deleted,
    v_items_deleted;
end;
$$;

grant execute on function public.reset_rate_assessment(uuid) to authenticated;
