'use server'

import { getSessionWithProfile } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import type {
  ActionClassification,
  ActionPriority,
  ActionStatus,
  InsertDto,
  UpdateDto,
} from '@/types/database.types'

// createdBy ausente intencionalmente: o servidor define created_by via session.profile.id.
// O formulário envia apenas dados funcionais da ação.
export interface ActionFormPayload {
  projectId: string
  title: string
  description: string | null
  assignedTo: string | null
  dueDate: string | null
  priority: ActionPriority
  status: ActionStatus
  classification: ActionClassification
  completionDate: string | null
  notes: string | null
  visibleToClient: boolean
  assigneeIds: string[]
}

type ActionResult =
  | { actionId: string; error?: never }
  | { actionId?: never; error: string }

// project_id não está em UpdateDto<'actions'> gerado automaticamente.
// O campo existe no banco e é atualizável; a extensão local cobre o caminho exclusivo de admin.
type ActionUpdatePayload = UpdateDto<'actions'> & { project_id?: string }

// Valida que o consultor é main_consultant ou membro do projeto.
async function validateConsultorProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
): Promise<string | null> {
  const { data: projectRaw } = await supabase
    .from('projects')
    .select('main_consultant_id')
    .eq('id', projectId)
    .single()

  const project = projectRaw as { main_consultant_id: string | null } | null

  if (!project) return 'Projeto não encontrado.'
  if (project.main_consultant_id === userId) return null

  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return 'Sem permissão para criar ação neste projeto.'
  return null
}

// action_assignees criado na Rodada D; ainda não presente no schema gerado automaticamente.
// `as any` isolado nesta função para não propagar pelo restante do módulo.
async function syncAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  assigneeIds: string[],
): Promise<string | null> {
  const { error: deleteError } = await (supabase.from('action_assignees') as any)
    .delete()
    .eq('action_id', actionId)

  if (deleteError) {
    return `Ação salva, mas falha ao limpar responsáveis: ${deleteError.message}`
  }

  if (assigneeIds.length > 0) {
    const rows = assigneeIds.map(userId => ({ action_id: actionId, user_id: userId }))
    const { error: insertError } = await (supabase.from('action_assignees') as any).insert(rows)
    if (insertError) {
      return `Ação salva, mas falha ao vincular responsáveis: ${insertError.message}`
    }
  }

  return null
}

export async function createAction(payload: ActionFormPayload): Promise<ActionResult> {
  const session = await getSessionWithProfile()
  if (session.status !== 'authenticated') return { error: 'Não autenticado.' }

  const { profile } = session
  const isAdmin = profile.role === 'admin_faus'
  const supabase = await createClient()

  if (!isAdmin) {
    const accessError = await validateConsultorProjectAccess(supabase, payload.projectId, profile.id)
    if (accessError) return { error: accessError }
  }

  // Payload tipado manualmente para garantia em tempo de compilação.
  // `as any` no query builder é padrão deste codebase com Supabase SSR 0.4.x:
  // o método .insert() infere `never` sem o cast — ver DiaryEntryForm e outros forms.
  const insertPayload: InsertDto<'actions'> = {
    project_id:        payload.projectId,
    title:             payload.title,
    description:       payload.description,
    assigned_to:       payload.assignedTo,
    due_date:          payload.dueDate,
    priority:          payload.priority,
    status:            payload.status,
    classification:    payload.classification,
    completion_date:   payload.completionDate,
    notes:             payload.notes,
    visible_to_client: payload.visibleToClient,
    created_by:        profile.id,  // servidor é a fonte de verdade — não aceito do cliente
  }

  const { data, error } = await (supabase.from('actions') as any)
    .insert(insertPayload)
    .select('id')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Não foi possível criar a ação.' }
  }

  const actionId = (data as { id: string }).id

  const assigneeError = await syncAssignees(supabase, actionId, payload.assigneeIds)
  if (assigneeError) return { error: assigneeError }

  return { actionId }
}

export async function updateAction(
  actionId: string,
  payload: ActionFormPayload,
): Promise<ActionResult> {
  const session = await getSessionWithProfile()
  if (session.status !== 'authenticated') return { error: 'Não autenticado.' }

  const { profile } = session
  const isAdmin = profile.role === 'admin_faus'
  const supabase = await createClient()

  // Busca project_id atual para validar tentativa de alteração por não-admin.
  const { data: currentActionRaw } = await supabase
    .from('actions')
    .select('project_id')
    .eq('id', actionId)
    .single()

  const currentAction = currentActionRaw as { project_id: string } | null

  if (!currentAction) return { error: 'Ação não encontrada.' }

  if (!isAdmin && payload.projectId !== currentAction.project_id) {
    return { error: 'Sem permissão para alterar o projeto de uma ação.' }
  }

  const updatePayload: ActionUpdatePayload = {
    title:           payload.title,
    description:     payload.description,
    assigned_to:     payload.assignedTo,
    due_date:        payload.dueDate,
    priority:        payload.priority,
    status:          payload.status,
    classification:  payload.classification,
    completion_date: payload.completionDate,
    notes:           payload.notes,
    visible_to_client: payload.visibleToClient,
  }

  if (isAdmin && payload.projectId !== currentAction.project_id) {
    updatePayload.project_id = payload.projectId
  }

  // `as any` no query builder: mesmo padrão do INSERT — Supabase SSR 0.4.x infere `never` sem o cast.
  // O payload continua tipado como ActionUpdatePayload; o `as any` isola apenas o query builder.
  const { data, error } = await (supabase.from('actions') as any)
    .update(updatePayload)
    .eq('id', actionId)
    .select('id')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Não foi possível atualizar a ação.' }
  }

  const assigneeError = await syncAssignees(supabase, (data as { id: string }).id, payload.assigneeIds)
  if (assigneeError) return { error: assigneeError }

  return { actionId: (data as { id: string }).id }
}
