drop policy if exists "rate_assessments_internal_write" on public.rate_assessments;
drop policy if exists "rate_assessment_versions_internal_write" on public.rate_assessment_versions;
drop policy if exists "rate_assessment_items_internal_write" on public.rate_assessment_items;

create policy "rate_assessments_internal_write"
on public.rate_assessments
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin_faus'
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
      and p.role = 'admin_faus'
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = rate_assessments.project_id
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
      and p.role = 'admin_faus'
      and p.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.rate_assessments ra
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.role = 'admin_faus'
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
      and p.role = 'admin_faus'
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
      and p.role = 'admin_faus'
      and p.is_active = true
  )
);
