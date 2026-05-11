-- ============================================================
-- Migration: 20260511_fix_child_rls
-- Depende de: 20260511_fix_project_membership
--   (is_project_member já considera main_consultant_id)
--
-- Propósito:
--   Restringir consultor_faus nas tabelas filhas para apenas
--   os projetos de que sejam membros.
--
-- Escopo: somente policies vulneráveis confirmadas via pg_policies.
--
-- Padrão aplicado em tabelas com project_id direto:
--   admin_faus → acesso total
--   consultor_faus → acesso somente se is_project_member(project_id)
--
-- Tabelas com project_id indireto usam JOIN explícito até
-- a coluna project_id e aplicam is_project_member sobre ela.
--
-- Policies preservadas sem alteração:
--   project_diagnoses_client_read_released
--   diagnosis_indicators_client_read_released
--   rate_assessments_internal_write     (admin only — correta)
--   rate_assessment_versions_internal_write (admin only — correta)
--   rate_assessment_items_internal_write    (admin only — correta)
--   document_folders_internal_write     (admin only — correta)
--   diary_entries / diary_deliverables  (já corretas em 20260503)
--
-- Tabelas fora do escopo desta rodada (já corretas no dashboard):
--   actions, kpis, kpi_records, meetings, documents,
--   timeline_events, audit_logs, clients, projects, project_members
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. project_diagnoses
--    project_id direto
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_diagnoses_internal_read" ON public.project_diagnoses;
CREATE POLICY "project_diagnoses_internal_read"
ON public.project_diagnoses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);

DROP POLICY IF EXISTS "project_diagnoses_internal_write" ON public.project_diagnoses;
CREATE POLICY "project_diagnoses_internal_write"
ON public.project_diagnoses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 2. diagnosis_indicators
--    project_id direto
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "diagnosis_indicators_internal_read" ON public.diagnosis_indicators;
CREATE POLICY "diagnosis_indicators_internal_read"
ON public.diagnosis_indicators FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);

DROP POLICY IF EXISTS "diagnosis_indicators_internal_write" ON public.diagnosis_indicators;
CREATE POLICY "diagnosis_indicators_internal_write"
ON public.diagnosis_indicators FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 3. rate_assessments
--    project_id direto
--    internal_write já é admin_only (preservada, não recriada)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rate_assessments_internal_read" ON public.rate_assessments;
CREATE POLICY "rate_assessments_internal_read"
ON public.rate_assessments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 4. rate_assessment_versions
--    project_id via: assessment_id → rate_assessments.project_id
--    internal_write já é admin_only (preservada)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rate_assessment_versions_internal_read" ON public.rate_assessment_versions;
CREATE POLICY "rate_assessment_versions_internal_read"
ON public.rate_assessment_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rate_assessments ra
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE ra.id = rate_assessment_versions.assessment_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(ra.project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 5. rate_assessment_items
--    project_id via: version_id → rate_assessment_versions →
--                    rate_assessments.project_id
--    internal_write já é admin_only (preservada)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rate_assessment_items_internal_read" ON public.rate_assessment_items;
CREATE POLICY "rate_assessment_items_internal_read"
ON public.rate_assessment_items FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rate_assessment_versions rv
    JOIN public.rate_assessments ra ON ra.id = rv.assessment_id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE rv.id = rate_assessment_items.version_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(ra.project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 6. kpi_target_periods
--    project_id via: kpi_id → kpis.project_id
--    Nota: USING da write original só verificava role, sem join
--    com kpis — qualquer consultor podia deletar períodos alheios.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kpi_target_periods_internal_read" ON public.kpi_target_periods;
CREATE POLICY "kpi_target_periods_internal_read"
ON public.kpi_target_periods FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_target_periods.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
);

DROP POLICY IF EXISTS "kpi_target_periods_internal_write" ON public.kpi_target_periods;
CREATE POLICY "kpi_target_periods_internal_write"
ON public.kpi_target_periods FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_target_periods.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_target_periods.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 7. kpi_period_records
--    project_id via: kpi_id → kpis.project_id
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kpi_period_records_internal_read" ON public.kpi_period_records;
CREATE POLICY "kpi_period_records_internal_read"
ON public.kpi_period_records FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_period_records.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
);

DROP POLICY IF EXISTS "kpi_period_records_internal_write" ON public.kpi_period_records;
CREATE POLICY "kpi_period_records_internal_write"
ON public.kpi_period_records FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_period_records.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.kpis k
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE k.id = kpi_period_records.kpi_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(k.project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 8. fsps
--    project_id direto
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fsps_internal_read" ON public.fsps;
CREATE POLICY "fsps_internal_read"
ON public.fsps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);

DROP POLICY IF EXISTS "fsps_internal_write" ON public.fsps;
CREATE POLICY "fsps_internal_write"
ON public.fsps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 9. action_steps
--    project_id via: action_id → actions.project_id
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "action_steps_internal_read" ON public.action_steps;
CREATE POLICY "action_steps_internal_read"
ON public.action_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.actions a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = action_steps.action_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(a.project_id))
      )
  )
);

DROP POLICY IF EXISTS "action_steps_internal_write" ON public.action_steps;
CREATE POLICY "action_steps_internal_write"
ON public.action_steps FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.actions a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = action_steps.action_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(a.project_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.actions a
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.id = action_steps.action_id
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(a.project_id))
      )
  )
);


-- ─────────────────────────────────────────────────────────────
-- 10. document_folders
--     project_id direto
--     internal_write já é admin_only (preservada)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "document_folders_internal_read" ON public.document_folders;
CREATE POLICY "document_folders_internal_read"
ON public.document_folders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND (
        p.role = 'admin_faus'
        OR (p.role = 'consultor_faus' AND public.is_project_member(project_id))
      )
  )
);
