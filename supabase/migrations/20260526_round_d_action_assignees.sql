-- =============================================================================
-- Rodada D — Múltiplos responsáveis por ação
-- Cria tabela action_assignees, migra dados de actions.assigned_to,
-- habilita RLS e cria policies replicando a lógica de actions.
-- NÃO remove nem altera actions.assigned_to (compatibilidade legada).
-- =============================================================================

-- ── Tabela ────────────────────────────────────────────────────────────────────

create table if not exists public.action_assignees (
  id         uuid        primary key default gen_random_uuid(),
  action_id  uuid        not null references public.actions(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(action_id, user_id)
);

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists action_assignees_action_id_idx
  on public.action_assignees(action_id);

create index if not exists action_assignees_user_id_idx
  on public.action_assignees(user_id);

-- ── Migração de dados existentes ─────────────────────────────────────────────

insert into public.action_assignees (action_id, user_id)
select id, assigned_to
from public.actions
where assigned_to is not null
on conflict do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.action_assignees enable row level security;

-- admin_faus: acesso total (leitura e escrita)
create policy "action_assignees: admin acesso total"
on public.action_assignees
for all
using (
  get_user_role() = 'admin_faus'::public.user_role
)
with check (
  get_user_role() = 'admin_faus'::public.user_role
);

-- consultor_faus: acesso às vinculações de ações dos projetos que pertence
create policy "action_assignees: consultor acessa seus projetos"
on public.action_assignees
for all
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and exists (
    select 1 from public.actions a
    where a.id = action_assignees.action_id
      and is_project_member(a.project_id)
  )
)
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and exists (
    select 1 from public.actions a
    where a.id = action_assignees.action_id
      and is_project_member(a.project_id)
  )
);

-- gestor_faus: apenas leitura (sem INSERT/UPDATE/DELETE)
create policy "action_assignees: gestor_faus leitura"
on public.action_assignees
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'gestor_faus'
  )
);

-- cliente: sem acesso direto.
-- O portal continua usando actions.assigned_to via RLS de actions.
