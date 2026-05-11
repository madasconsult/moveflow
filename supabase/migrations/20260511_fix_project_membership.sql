-- ============================================================
-- Migration: 20260511_fix_project_membership
-- Propósito:
--   1. Corrigir is_project_member para considerar main_consultant_id
--   2. Garantir unicidade em project_members(project_id, user_id)
--   3. Criar trigger de sincronização main_consultant_id → project_members
--   4. Backfill de projetos existentes que já tinham main_consultant_id
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Corrigir is_project_member
--    Antes: verificava apenas project_members
--    Depois: verifica project_members OU main_consultant_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = p_project_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.projects
      WHERE id = p_project_id
        AND main_consultant_id = auth.uid()
    );
$function$;

-- ─────────────────────────────────────────────────────────────
-- 2. Garantir unicidade em project_members(project_id, user_id)
--    Necessário para que ON CONFLICT funcione no trigger.
--    Se já existir duplicatas, este comando falhará — indicando
--    que há dados inconsistentes a serem tratados manualmente.
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_user_unique
  ON public.project_members (project_id, user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Função de sincronização
--    Dispara após INSERT ou UPDATE DE main_consultant_id em projects.
--    - Não remove o consultor anterior.
--    - Não quebra projetos com main_consultant_id null.
--    - Usa COALESCE(auth.uid(), NEW.created_by) como added_by
--      (ambos são nullable — added_by também é nullable na tabela).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_main_consultant_to_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem consultor definido: nada a sincronizar
  IF NEW.main_consultant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE: pular se o valor não mudou
  IF TG_OP = 'UPDATE'
     AND (NEW.main_consultant_id IS NOT DISTINCT FROM OLD.main_consultant_id)
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role_in_project, added_by)
  VALUES (
    NEW.id,
    NEW.main_consultant_id,
    'lead',
    COALESCE(auth.uid(), NEW.created_by)
  )
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET role_in_project = 'lead';

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Trigger na tabela projects
--    AFTER: garante que o projeto já existe quando a FK é verificada.
--    UPDATE OF main_consultant_id: só dispara quando essa coluna
--    é incluída no SET — reduz execuções desnecessárias.
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_main_consultant_trigger ON public.projects;
CREATE TRIGGER sync_main_consultant_trigger
  AFTER INSERT OR UPDATE OF main_consultant_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_main_consultant_to_members();

-- ─────────────────────────────────────────────────────────────
-- 5. Backfill
--    Insere em project_members todos os projetos existentes que
--    já têm main_consultant_id definido e ainda não têm registro
--    correspondente. Não toca em registros já existentes.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.project_members (project_id, user_id, role_in_project, added_by)
SELECT
  p.id         AS project_id,
  p.main_consultant_id AS user_id,
  'lead'       AS role_in_project,
  p.created_by AS added_by
FROM public.projects p
WHERE p.main_consultant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p.id
      AND pm.user_id = p.main_consultant_id
  );
