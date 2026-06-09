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
  /** IDs de envolvidos externos já cadastrados a vincular */
  externalStakeholderIds: string[]
  /** Novos envolvidos externos a criar e vincular (criação inline no formulário) */
  newExternalStakeholders: NewExternalStakeholder[]
}

export interface NewExternalStakeholder {
  name: string
  role_title: string | null
  email: string | null
  phone: string | null
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

/**
 * Sincroniza envolvidos externos de uma ação.
 * Rodada E: tabelas criadas em 20260609_round_e_external_stakeholders.sql.
 *
 * Fluxo:
 *  1. Criar envolvidos novos em project_external_stakeholders (se ainda não existirem).
 *  2. Remover todos os vínculos atuais em action_external_stakeholders.
 *  3. Inserir os vínculos finais (existentes + recém-criados).
 *
 * Validação de integridade: todos os stakeholder_ids devem pertencer ao mesmo
 * projeto da ação — rejeitado antes de qualquer escrita se houver divergência.
 */
async function syncExternalStakeholders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  actionProjectId: string,
  existingIds: string[],
  newStakeholders: NewExternalStakeholder[],
  createdBy: string,
): Promise<string | null> {
  // 1. Validar que todos os IDs existentes pertencem ao projeto da ação.
  if (existingIds.length > 0) {
    const { data: validateRaw, error: validateError } = await (
      supabase.from('project_external_stakeholders') as any
    )
      .select('id, project_id')
      .in('id', existingIds)

    if (validateError) {
      return `Falha ao validar envolvidos externos: ${validateError.message}`
    }

    const rows = (validateRaw as { id: string; project_id: string }[] | null) ?? []
    const wrongProject = rows.find(r => r.project_id !== actionProjectId)
    if (wrongProject) {
      return 'Um ou mais envolvidos externos pertencem a projeto diferente desta ação.'
    }
    if (rows.length !== existingIds.length) {
      return 'Um ou mais envolvidos externos não foram encontrados.'
    }
  }

  // 2. Criar novos envolvidos em project_external_stakeholders (ON CONFLICT ignora duplicatas).
  const createdIds: string[] = []
  for (const s of newStakeholders) {
    const trimmedName = s.name.trim()
    if (!trimmedName) continue

    // Tenta inserir; se nome já existe no projeto (índice único case-insensitive), faz upsert
    // buscando o existente para não perder o ID.
    const insertRow = {
      project_id: actionProjectId,
      name:       trimmedName,
      role_title: s.role_title?.trim() || null,
      email:      s.email?.trim() || null,
      phone:      s.phone?.trim() || null,
      created_by: createdBy,
    }

    const { data: insertedRaw, error: insertError } = await (
      supabase.from('project_external_stakeholders') as any
    )
      .insert(insertRow)
      .select('id')
      .single()

    if (insertError) {
      // Código 23505 = unique_violation (nome duplicado no projeto)
      if (insertError.code === '23505') {
        // Busca o existente pelo nome
        const { data: existingRaw, error: lookupError } = await (
          supabase.from('project_external_stakeholders') as any
        )
          .select('id')
          .eq('project_id', actionProjectId)
          .ilike('name', trimmedName)
          .single()

        if (lookupError || !existingRaw) {
          return `Falha ao localizar envolvido existente "${trimmedName}": ${lookupError?.message ?? 'não encontrado'}`
        }
        createdIds.push((existingRaw as { id: string }).id)
      } else {
        return `Falha ao criar envolvido "${trimmedName}": ${insertError.message}`
      }
    } else {
      createdIds.push((insertedRaw as { id: string }).id)
    }
  }

  // 3. IDs finais = existentes validados + recém-criados (deduplica)
  const finalIds = Array.from(new Set([...existingIds, ...createdIds]))

  // 4. Remove vínculos anteriores
  const { error: deleteError } = await (
    supabase.from('action_external_stakeholders') as any
  )
    .delete()
    .eq('action_id', actionId)

  if (deleteError) {
    return `Ação salva, mas falha ao limpar envolvidos externos: ${deleteError.message}`
  }

  // 5. Insere vínculos finais
  if (finalIds.length > 0) {
    const linkRows = finalIds.map(stakeholder_id => ({ action_id: actionId, stakeholder_id }))
    const { error: linkError } = await (
      supabase.from('action_external_stakeholders') as any
    ).insert(linkRows)

    if (linkError) {
      return `Ação salva, mas falha ao vincular envolvidos externos: ${linkError.message}`
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

  const externalError = await syncExternalStakeholders(
    supabase,
    actionId,
    payload.projectId,
    payload.externalStakeholderIds,
    payload.newExternalStakeholders,
    profile.id,
  )
  if (externalError) return { error: externalError }

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

  // O project_id efetivo para validação de envolvidos externos é o projeto FINAL da ação
  const effectiveProjectId = updatePayload.project_id ?? currentAction.project_id

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

  const savedId = (data as { id: string }).id

  const assigneeError = await syncAssignees(supabase, savedId, payload.assigneeIds)
  if (assigneeError) return { error: assigneeError }

  const externalError = await syncExternalStakeholders(
    supabase,
    savedId,
    effectiveProjectId,
    payload.externalStakeholderIds,
    payload.newExternalStakeholders,
    profile.id,
  )
  if (externalError) return { error: externalError }

  return { actionId: savedId }
}
