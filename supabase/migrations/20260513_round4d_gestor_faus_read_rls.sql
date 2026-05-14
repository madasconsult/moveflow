-- Rodada 4D - RLS de leitura ampla para gestor_faus.
-- Escopo: adicionar somente policies de SELECT para o novo perfil gestor_faus.
-- Nao altera writes admin-only, policies de cliente, funcoes existentes ou storage.

-- ─────────────────────────────────────────────────────────────
-- Tabelas base
-- ─────────────────────────────────────────────────────────────

drop policy if exists "clients_gestor_faus_read" on public.clients;
create policy "clients_gestor_faus_read"
on public.clients
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "projects_gestor_faus_read" on public.projects;
create policy "projects_gestor_faus_read"
on public.projects
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "project_members_gestor_faus_read" on public.project_members;
create policy "project_members_gestor_faus_read"
on public.project_members
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

-- ─────────────────────────────────────────────────────────────
-- Tabelas filhas com project_id direto
-- ─────────────────────────────────────────────────────────────

drop policy if exists "actions_gestor_faus_read" on public.actions;
create policy "actions_gestor_faus_read"
on public.actions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = actions.project_id
  )
);

drop policy if exists "kpis_gestor_faus_read" on public.kpis;
create policy "kpis_gestor_faus_read"
on public.kpis
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = kpis.project_id
  )
);

drop policy if exists "meetings_gestor_faus_read" on public.meetings;
create policy "meetings_gestor_faus_read"
on public.meetings
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = meetings.project_id
  )
);

drop policy if exists "documents_gestor_faus_read" on public.documents;
create policy "documents_gestor_faus_read"
on public.documents
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = documents.project_id
  )
);

drop policy if exists "document_folders_gestor_faus_read" on public.document_folders;
create policy "document_folders_gestor_faus_read"
on public.document_folders
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = document_folders.project_id
  )
);

drop policy if exists "fsps_gestor_faus_read" on public.fsps;
create policy "fsps_gestor_faus_read"
on public.fsps
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = fsps.project_id
  )
);

drop policy if exists "project_diagnoses_gestor_faus_read" on public.project_diagnoses;
create policy "project_diagnoses_gestor_faus_read"
on public.project_diagnoses
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_diagnoses.project_id
  )
);

drop policy if exists "diagnosis_indicators_gestor_faus_read" on public.diagnosis_indicators;
create policy "diagnosis_indicators_gestor_faus_read"
on public.diagnosis_indicators
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = diagnosis_indicators.project_id
  )
);

drop policy if exists "rate_assessments_gestor_faus_read" on public.rate_assessments;
create policy "rate_assessments_gestor_faus_read"
on public.rate_assessments
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = rate_assessments.project_id
  )
);

drop policy if exists "timeline_events_gestor_faus_read" on public.timeline_events;
create policy "timeline_events_gestor_faus_read"
on public.timeline_events
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = timeline_events.project_id
  )
);

drop policy if exists "diary_entries_gestor_faus_read" on public.diary_entries;
create policy "diary_entries_gestor_faus_read"
on public.diary_entries
for select
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = diary_entries.project_id
  )
);

-- ─────────────────────────────────────────────────────────────
-- Tabelas filhas com project_id indireto
-- ─────────────────────────────────────────────────────────────

drop policy if exists "action_steps_gestor_faus_read" on public.action_steps;
create policy "action_steps_gestor_faus_read"
on public.action_steps
for select
using (
  exists (
    select 1
    from public.actions a
    join public.profiles p on p.id = auth.uid()
    where a.id = action_steps.action_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "kpi_records_gestor_faus_read" on public.kpi_records;
create policy "kpi_records_gestor_faus_read"
on public.kpi_records
for select
using (
  exists (
    select 1
    from public.kpis k
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_records.kpi_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "kpi_target_periods_gestor_faus_read" on public.kpi_target_periods;
create policy "kpi_target_periods_gestor_faus_read"
on public.kpi_target_periods
for select
using (
  exists (
    select 1
    from public.kpis k
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_target_periods.kpi_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "kpi_period_records_gestor_faus_read" on public.kpi_period_records;
create policy "kpi_period_records_gestor_faus_read"
on public.kpi_period_records
for select
using (
  exists (
    select 1
    from public.kpis k
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_period_records.kpi_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "rate_assessment_versions_gestor_faus_read" on public.rate_assessment_versions;
create policy "rate_assessment_versions_gestor_faus_read"
on public.rate_assessment_versions
for select
using (
  exists (
    select 1
    from public.rate_assessments ra
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "rate_assessment_items_gestor_faus_read" on public.rate_assessment_items;
create policy "rate_assessment_items_gestor_faus_read"
on public.rate_assessment_items
for select
using (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

drop policy if exists "diary_deliverables_gestor_faus_read" on public.diary_deliverables;
create policy "diary_deliverables_gestor_faus_read"
on public.diary_deliverables
for select
using (
  exists (
    select 1
    from public.diary_entries de
    join public.profiles p on p.id = auth.uid()
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);
