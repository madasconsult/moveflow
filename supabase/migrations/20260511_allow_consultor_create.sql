-- ============================================================
-- Migration: 20260511_allow_consultor_create
-- Propósito:
--   Permitir que consultor_faus crie clientes e projetos com
--   restrições de segurança:
--
--   1. clients INSERT: consultor pode inserir apenas clientes que ele mesmo criará (created_by = auth.uid()).
--   2. clients SELECT (adicional): consultor vê clientes que ele
--      mesmo criou (created_by = auth.uid()) — resolve o
--      chicken-and-egg de selecionar o cliente recém-criado no
--      formulário de novo projeto.
--   3. projects INSERT: consultor pode inserir apenas se
--      main_consultant_id = auth.uid() — enforcement na DB.
--
-- Policies existentes preservadas:
--   clients: admin acesso total
--   clients: cliente le o proprio registro
--   clients: consultor le clientes dos seus projetos
--   projects: admin acesso total
--   projects: cliente le o proprio projeto
--   projects: consultor le projetos vinculados
--   projects: consultor edita projetos vinculados
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. clients — INSERT para consultor_faus
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clients: consultor insere cliente" ON public.clients;
CREATE POLICY "clients: consultor insere cliente"
ON public.clients FOR INSERT
WITH CHECK (
  get_user_role() = 'consultor_faus'
  AND created_by = auth.uid()
);


-- ─────────────────────────────────────────────────────────────
-- 2. clients — SELECT adicional para clientes criados pelo consultor
--    Resolve o caso em que o consultor criou um cliente mas ainda
--    não tem projetos vinculados a ele.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clients: consultor le clientes que criou" ON public.clients;
CREATE POLICY "clients: consultor le clientes que criou"
ON public.clients FOR SELECT
USING (
  get_user_role() = 'consultor_faus'
  AND created_by = auth.uid()
);


-- ─────────────────────────────────────────────────────────────
-- 3. projects — INSERT para consultor_faus
--    WITH CHECK garante que main_consultant_id = auth.uid().
--    Qualquer tentativa de criar um projeto para outro consultor
--    é rejeitada pelo banco, independente do front-end.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects: consultor insere projeto proprio" ON public.projects;
CREATE POLICY "projects: consultor insere projeto proprio"
ON public.projects FOR INSERT
WITH CHECK (
  get_user_role() = 'consultor_faus'
  AND main_consultant_id = auth.uid()
  AND created_by = auth.uid()
);
