-- =============================================================================
-- Rodada G3 — Restringir DELETE de actions a admin_faus
-- Decisão de governança: ações são evidências de gestão e não devem ser
-- removidas por perfil operacional. Exclusão definitiva é admin-only.
--
-- Problema: "actions: consultor acessa acoes dos seus projetos" é FOR ALL,
-- o que inclui DELETE. Consultor não deve poder deletar ações.
--
-- Correção: substituir a policy FOR ALL por três policies separadas:
--   SELECT: is_project_member — leitura mantida para qualquer membro
--   INSERT: is_project_member — criação mantida para qualquer membro
--   UPDATE: is_project_member — edição mantida para qualquer membro
--   DELETE: removido para consultor; coberto apenas por "admin acesso total"
--
-- Compatibilidade preservada:
--   admin_faus  → acesso total via "actions: admin acesso total" (não alterado)
--   gestor_faus → leitura via "actions_gestor_faus_read" (não alterado)
--   cliente     → leitura via "actions: cliente le acoes visiveis..." (não alterado)
--   INSERT/UPDATE específicos para lead → "actions_operational_insert/update_admin_or_lead" (não alterados)
--
-- NÃO altera: tabelas, dados, índices, funções helper.
-- NÃO altera: policies de gestor_faus, cliente, admin.
-- =============================================================================


-- ── Remover policy FOR ALL do consultor ──────────────────────────────────────

drop policy if exists "actions: consultor acessa acoes dos seus projetos"
  on public.actions;


-- ── Recriar como SELECT/INSERT/UPDATE separados (sem DELETE) ─────────────────

-- SELECT: qualquer membro do projeto pode ler ações
create policy "actions: consultor le acoes dos seus projetos"
on public.actions
for select
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(project_id)
);

-- INSERT: qualquer membro do projeto pode criar ações
-- (compatível com validateConsultorProjectAccess no server action,
--  que aceita main_consultant_id OU project_members)
create policy "actions: consultor insere acoes dos seus projetos"
on public.actions
for insert
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(project_id)
);

-- UPDATE: qualquer membro do projeto pode editar ações
-- (policy mais específica actions_operational_update_admin_or_lead
--  restringe ao lead — ambas coexistem sem conflito via OR)
create policy "actions: consultor atualiza acoes dos seus projetos"
on public.actions
for update
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(project_id)
)
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(project_id)
);

-- DELETE: nenhuma policy para consultor_faus.
-- Apenas "actions: admin acesso total" (FOR ALL) cobre DELETE — admin-only.
