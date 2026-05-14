-- Rodada 4H - Permissoes operacionais para Consultor Principal.
--
-- Escopo:
-- - Consultor Principal = projects.main_consultant_id = auth.uid().
-- - Gestor FAUS permanece com leitura ampla, sem escrita operacional ampla.
-- - Cliente permanece sem escrita.
-- - Campos estruturais de KPI continuam protegidos pela UI; RLS nao faz controle por coluna.

-- Projetos: consultor_faus cria projeto proprio e pode informar gestor elegivel.
drop policy if exists "projects: consultor insere projeto proprio" on public.projects;
create policy "projects: consultor insere projeto proprio"
on public.projects
for insert
with check (
  get_user_role() = 'consultor_faus'
  and main_consultant_id = auth.uid()
  and created_by = auth.uid()
  and project_manager_id is not null
  and exists (
    select 1
    from public.profiles manager
    where manager.id = projects.project_manager_id
      and manager.is_active = true
      and manager.role::text in ('admin_faus', 'gestor_faus')
  )
);

-- Acoes: consultor principal cria e edita acoes dos proprios projetos.
drop policy if exists "actions_operational_insert_admin_or_lead" on public.actions;
create policy "actions_operational_insert_admin_or_lead"
on public.actions
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = actions.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
          and actions.created_by = auth.uid()
        )
      )
  )
);

drop policy if exists "actions_operational_update_admin_or_lead" on public.actions;
create policy "actions_operational_update_admin_or_lead"
on public.actions
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = actions.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = actions.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

-- Etapas de acoes: admin ou consultor principal operam etapas das acoes do projeto.
drop policy if exists "action_steps_internal_write" on public.action_steps;
create policy "action_steps_internal_write"
on public.action_steps
for all
using (
  exists (
    select 1
    from public.actions a
    join public.projects pr on pr.id = a.project_id
    join public.profiles p on p.id = auth.uid()
    where a.id = action_steps.action_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.actions a
    join public.projects pr on pr.id = a.project_id
    join public.profiles p on p.id = auth.uid()
    where a.id = action_steps.action_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

-- Diario de Bordo: escrita apenas admin ou consultor principal.
drop policy if exists "diary_entries_internal_insert" on public.diary_entries;
create policy "diary_entries_internal_insert"
on public.diary_entries
for insert
with check (
  deleted_at is null
  and created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

drop policy if exists "diary_entries_internal_update" on public.diary_entries;
create policy "diary_entries_internal_update"
on public.diary_entries
for update
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
          and diary_entries.deleted_at is null
        )
      )
  )
);

drop policy if exists "diary_deliverables_internal_write" on public.diary_deliverables;
create policy "diary_deliverables_internal_write"
on public.diary_deliverables
for all
using (
  exists (
    select 1
    from public.diary_entries de
    join public.projects pr on pr.id = de.project_id
    join public.profiles p on p.id = auth.uid()
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.diary_entries de
    join public.projects pr on pr.id = de.project_id
    join public.profiles p on p.id = auth.uid()
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

-- KPIs: consultor principal cria e atualiza leitura operacional dos KPIs do proprio projeto.
drop policy if exists "kpis_operational_insert_admin_or_lead" on public.kpis;
create policy "kpis_operational_insert_admin_or_lead"
on public.kpis
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = kpis.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
          and kpis.created_by = auth.uid()
        )
      )
  )
);

drop policy if exists "kpis_operational_update_admin_or_lead" on public.kpis;
create policy "kpis_operational_update_admin_or_lead"
on public.kpis
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = kpis.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = kpis.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

-- Metas/faixas de KPI sao governanca estrutural: escrita apenas admin_faus.
drop policy if exists "kpi_target_periods_internal_write" on public.kpi_target_periods;
create policy "kpi_target_periods_internal_write"
on public.kpi_target_periods
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

-- Apuracoes de KPI: admin ou consultor principal podem inserir/atualizar.
drop policy if exists "kpi_period_records_internal_write" on public.kpi_period_records;
drop policy if exists "kpi_period_records_internal_insert_admin_or_lead" on public.kpi_period_records;
drop policy if exists "kpi_period_records_internal_update_admin_or_lead" on public.kpi_period_records;
drop policy if exists "kpi_period_records_internal_delete_admin" on public.kpi_period_records;

create policy "kpi_period_records_internal_insert_admin_or_lead"
on public.kpi_period_records
for insert
with check (
  exists (
    select 1
    from public.kpis k
    join public.projects pr on pr.id = k.project_id
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_period_records.kpi_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "kpi_period_records_internal_update_admin_or_lead"
on public.kpi_period_records
for update
using (
  exists (
    select 1
    from public.kpis k
    join public.projects pr on pr.id = k.project_id
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_period_records.kpi_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.kpis k
    join public.projects pr on pr.id = k.project_id
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_period_records.kpi_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "kpi_period_records_internal_delete_admin"
on public.kpi_period_records
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

-- Diagnostico: admin ou consultor principal podem inserir/atualizar; exclusao fica admin-only.
drop policy if exists "project_diagnoses_internal_write" on public.project_diagnoses;
drop policy if exists "project_diagnoses_internal_insert_admin_or_lead" on public.project_diagnoses;
drop policy if exists "project_diagnoses_internal_update_admin_or_lead" on public.project_diagnoses;
drop policy if exists "project_diagnoses_internal_delete_admin" on public.project_diagnoses;

create policy "project_diagnoses_internal_insert_admin_or_lead"
on public.project_diagnoses
for insert
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = project_diagnoses.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "project_diagnoses_internal_update_admin_or_lead"
on public.project_diagnoses
for update
using (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = project_diagnoses.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = project_diagnoses.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "project_diagnoses_internal_delete_admin"
on public.project_diagnoses
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

drop policy if exists "diagnosis_indicators_internal_write" on public.diagnosis_indicators;
drop policy if exists "diagnosis_indicators_internal_insert_admin_or_lead" on public.diagnosis_indicators;
drop policy if exists "diagnosis_indicators_internal_update_admin_or_lead" on public.diagnosis_indicators;
drop policy if exists "diagnosis_indicators_internal_delete_admin" on public.diagnosis_indicators;

create policy "diagnosis_indicators_internal_insert_admin_or_lead"
on public.diagnosis_indicators
for insert
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = diagnosis_indicators.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "diagnosis_indicators_internal_update_admin_or_lead"
on public.diagnosis_indicators
for update
using (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = diagnosis_indicators.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = diagnosis_indicators.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "diagnosis_indicators_internal_delete_admin"
on public.diagnosis_indicators
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

-- Rate FAUS: admin ou consultor principal podem inserir/atualizar; reset/exclusao fica admin-only.
drop policy if exists "rate_assessments_internal_write" on public.rate_assessments;
drop policy if exists "rate_assessments_internal_insert_admin_or_lead" on public.rate_assessments;
drop policy if exists "rate_assessments_internal_update_admin_or_lead" on public.rate_assessments;
drop policy if exists "rate_assessments_internal_delete_admin" on public.rate_assessments;

create policy "rate_assessments_internal_insert_admin_or_lead"
on public.rate_assessments
for insert
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = rate_assessments.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessments_internal_update_admin_or_lead"
on public.rate_assessments
for update
using (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = rate_assessments.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.projects pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = rate_assessments.project_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessments_internal_delete_admin"
on public.rate_assessments
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

drop policy if exists "rate_assessment_versions_internal_write" on public.rate_assessment_versions;
drop policy if exists "rate_assessment_versions_internal_insert_admin_or_lead" on public.rate_assessment_versions;
drop policy if exists "rate_assessment_versions_internal_update_admin_or_lead" on public.rate_assessment_versions;
drop policy if exists "rate_assessment_versions_internal_delete_admin" on public.rate_assessment_versions;

create policy "rate_assessment_versions_internal_insert_admin_or_lead"
on public.rate_assessment_versions
for insert
with check (
  exists (
    select 1
    from public.rate_assessments ra
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessment_versions_internal_update_admin_or_lead"
on public.rate_assessment_versions
for update
using (
  exists (
    select 1
    from public.rate_assessments ra
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.rate_assessments ra
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where ra.id = rate_assessment_versions.assessment_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessment_versions_internal_delete_admin"
on public.rate_assessment_versions
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);

drop policy if exists "rate_assessment_items_internal_write" on public.rate_assessment_items;
drop policy if exists "rate_assessment_items_internal_insert_admin_or_lead" on public.rate_assessment_items;
drop policy if exists "rate_assessment_items_internal_update_admin_or_lead" on public.rate_assessment_items;
drop policy if exists "rate_assessment_items_internal_delete_admin" on public.rate_assessment_items;

create policy "rate_assessment_items_internal_insert_admin_or_lead"
on public.rate_assessment_items
for insert
with check (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessment_items_internal_update_admin_or_lead"
on public.rate_assessment_items
for update
using (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.rate_assessment_versions rv
    join public.rate_assessments ra on ra.id = rv.assessment_id
    join public.projects pr on pr.id = ra.project_id
    join public.profiles p on p.id = auth.uid()
    where rv.id = rate_assessment_items.version_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and pr.main_consultant_id = auth.uid()
        )
      )
  )
);

create policy "rate_assessment_items_internal_delete_admin"
on public.rate_assessment_items
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
);
