-- =============================================================================
-- Rodada G2 — Correção de escopo alto em policies de leitura
-- Continuação da Rodada G1 (commit 98d1ac7).
--
-- Problema: policies de SELECT verificavam apenas role + EXISTS(kpi/project),
-- sem validar is_project_member(project_id) para consultor_faus.
--
-- Correção: recriar as 3 policies de leitura com OR explícito:
--   admin_faus     → acesso irrestrito (mantido)
--   consultor_faus → somente se is_project_member(project_id)
--
-- NÃO altera: tabelas, dados, índices, funções helper.
-- NÃO altera: policies de gestor_faus, escrita admin-only, INSERT/UPDATE/DELETE.
-- NÃO corrige: gestor_faus global, DELETE de actions (decisões de negócio futuras).
-- =============================================================================


-- ── 1. kpi_target_periods — corrigir leitura ─────────────────────────────────
-- kpi_target_periods não tem project_id direto.
-- Validação via: kpi_target_periods.kpi_id → kpis.project_id → is_project_member.
-- A policy de escrita (admin-only) não é alterada.
-- A policy de gestor_faus não é alterada.

drop policy if exists "kpi_target_periods_internal_read" on public.kpi_target_periods;

create policy "kpi_target_periods_internal_read"
on public.kpi_target_periods
for select
using (
  exists (
    select 1
    from public.kpis k
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_target_periods.kpi_id
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(k.project_id)
        )
      )
  )
);


-- ── 2. kpi_period_records — corrigir leitura ──────────────────────────────────
-- kpi_period_records não tem project_id direto.
-- Validação via: kpi_period_records.kpi_id → kpis.project_id → is_project_member.
-- As policies de INSERT, UPDATE e DELETE já estão corretas — não são alteradas.
-- A policy de gestor_faus não é alterada.

drop policy if exists "kpi_period_records_internal_read" on public.kpi_period_records;

create policy "kpi_period_records_internal_read"
on public.kpi_period_records
for select
using (
  exists (
    select 1
    from public.kpis k
    join public.profiles p on p.id = auth.uid()
    where k.id = kpi_period_records.kpi_id
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(k.project_id)
        )
      )
  )
);


-- ── 3. document_folders — corrigir leitura ────────────────────────────────────
-- document_folders tem project_id direto.
-- A policy de escrita (admin-only) não é alterada.
-- A policy de gestor_faus não é alterada.

drop policy if exists "document_folders_internal_read" on public.document_folders;

create policy "document_folders_internal_read"
on public.document_folders
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
          and public.is_project_member(document_folders.project_id)
        )
      )
  )
);
