-- =============================================================================
-- Rodada G1 — Correção de escopo crítico em policies de leitura/escrita
-- Auditoria F identificou que consultor_faus podia ler/escrever dados de
-- projetos onde não participa nas tabelas abaixo.
--
-- Problema: policies usavam apenas role IN (admin, consultor) + EXISTS(project),
-- sem verificar is_project_member(project_id).
--
-- Correção: recriar as policies com OR explícito:
--   admin_faus → acesso irrestrito (mantido)
--   consultor_faus → somente se is_project_member(project_id)
--
-- NÃO altera: tabelas, dados, índices, funções helper.
-- NÃO altera: policies de gestor_faus, cliente, escrita de diagnoses/indicators,
--             escrita de action_steps.
-- NÃO corrige G2 (kpi_target_periods, kpi_period_records, document_folders).
-- =============================================================================


-- ── 1. action_steps — corrigir leitura ───────────────────────────────────────
-- action_steps não tem project_id direto; precisa de JOIN via action_id → actions.project_id.
-- A policy de escrita (action_steps_internal_write) já está correta — não é alterada.

drop policy if exists "action_steps_internal_read" on public.action_steps;

create policy "action_steps_internal_read"
on public.action_steps
for select
using (
  exists (
    select 1
    from public.actions a
    join public.profiles p on p.id = auth.uid()
    where a.id = action_steps.action_id
      and p.is_active = true
      and (
        p.role::text = 'admin_faus'
        or (
          p.role::text = 'consultor_faus'
          and public.is_project_member(a.project_id)
        )
      )
  )
);


-- ── 2. fsps — corrigir leitura ────────────────────────────────────────────────
-- fsps tem project_id direto.

drop policy if exists "fsps_internal_read" on public.fsps;

create policy "fsps_internal_read"
on public.fsps
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(fsps.project_id)
        )
      )
  )
);


-- ── 3. fsps — corrigir escrita (INSERT/UPDATE/DELETE) ────────────────────────
-- Esta era a vulnerability mais grave: consultor podia alterar FSPs de qualquer projeto.

drop policy if exists "fsps_internal_write" on public.fsps;

create policy "fsps_internal_write"
on public.fsps
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(fsps.project_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(fsps.project_id)
        )
      )
  )
);


-- ── 4. project_diagnoses — corrigir leitura ───────────────────────────────────
-- project_diagnoses tem project_id direto.
-- Policies de escrita (insert_admin_or_lead, update_admin_or_lead, delete_admin) estão corretas.
-- Policies de gestor (gestor_faus_read) e cliente (client_read_released) não são alteradas.

drop policy if exists "project_diagnoses_internal_read" on public.project_diagnoses;

create policy "project_diagnoses_internal_read"
on public.project_diagnoses
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(project_diagnoses.project_id)
        )
      )
  )
);


-- ── 5. diagnosis_indicators — corrigir leitura ────────────────────────────────
-- diagnosis_indicators tem project_id direto.
-- Policies de escrita e cliente não são alteradas.

drop policy if exists "diagnosis_indicators_internal_read" on public.diagnosis_indicators;

create policy "diagnosis_indicators_internal_read"
on public.diagnosis_indicators
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(diagnosis_indicators.project_id)
        )
      )
  )
);
