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

  select ra.*
  into v_assessment
  from public.rate_assessments ra
  where ra.id = p_assessment_id;

  if not found then
    raise exception 'Rate FAUS não encontrado.';
  end if;

  select count(*)
  into v_versions_deleted
  from public.rate_assessment_versions rav
  where rav.assessment_id = p_assessment_id;

  select count(*)
  into v_items_deleted
  from public.rate_assessment_items rai
  where rai.version_id in (
    select rav.id
    from public.rate_assessment_versions rav
    where rav.assessment_id = p_assessment_id
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

  delete from public.rate_assessments ra
  where ra.id = p_assessment_id;

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
