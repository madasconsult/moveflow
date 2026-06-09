-- =============================================================================
-- Rodada E — Envolvidos externos do cliente em Ações
-- Cria:
--   1. project_external_stakeholders — cadastro de pessoas do cliente por projeto
--   2. action_external_stakeholders  — vínculo entre ações e envolvidos externos
-- RLS segue o padrão estabelecido em action_assignees e action_steps.
-- NÃO altera tabelas existentes. NÃO migra dados existentes.
-- =============================================================================


-- ── 1. project_external_stakeholders ─────────────────────────────────────────

create table if not exists public.project_external_stakeholders (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  name        text        not null,
  role_title  text        null,
  email       text        null,
  phone       text        null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        null references auth.users(id)
);

-- Evita duplicação de nome (case-insensitive) no mesmo projeto
create unique index if not exists pes_project_name_unique
  on public.project_external_stakeholders(project_id, lower(name));

create index if not exists pes_project_id_idx
  on public.project_external_stakeholders(project_id);


-- ── 2. action_external_stakeholders ──────────────────────────────────────────

create table if not exists public.action_external_stakeholders (
  id             uuid        primary key default gen_random_uuid(),
  action_id      uuid        not null references public.actions(id) on delete cascade,
  stakeholder_id uuid        not null references public.project_external_stakeholders(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique(action_id, stakeholder_id)
);

create index if not exists aes_action_id_idx
  on public.action_external_stakeholders(action_id);

create index if not exists aes_stakeholder_id_idx
  on public.action_external_stakeholders(stakeholder_id);


-- ── RLS: project_external_stakeholders ───────────────────────────────────────

alter table public.project_external_stakeholders enable row level security;

-- admin_faus: acesso total
create policy "pes: admin acesso total"
on public.project_external_stakeholders
for all
using (
  get_user_role() = 'admin_faus'::public.user_role
)
with check (
  get_user_role() = 'admin_faus'::public.user_role
);

-- consultor_faus: acesso total nos projetos aos quais pertence
create policy "pes: consultor acessa seus projetos"
on public.project_external_stakeholders
for all
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and is_project_member(project_id)
)
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and is_project_member(project_id)
);

-- gestor_faus: apenas leitura
create policy "pes: gestor_faus leitura"
on public.project_external_stakeholders
for select
using (
  get_user_role() = 'gestor_faus'::public.user_role
);

-- cliente: leitura dos envolvidos do próprio projeto
create policy "pes: cliente leitura projeto proprio"
on public.project_external_stakeholders
for select
using (
  get_user_role() = 'cliente'::public.user_role
  and exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = auth.uid()
    where p.id = project_external_stakeholders.project_id
      and pr.client_id = p.client_id
      and pr.is_active = true
  )
);


-- ── RLS: action_external_stakeholders ────────────────────────────────────────

alter table public.action_external_stakeholders enable row level security;

-- admin_faus: acesso total
create policy "aes: admin acesso total"
on public.action_external_stakeholders
for all
using (
  get_user_role() = 'admin_faus'::public.user_role
)
with check (
  get_user_role() = 'admin_faus'::public.user_role
);

-- consultor_faus: acesso às vinculações de ações dos projetos que pertence
create policy "aes: consultor acessa seus projetos"
on public.action_external_stakeholders
for all
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and exists (
    select 1 from public.actions a
    where a.id = action_external_stakeholders.action_id
      and is_project_member(a.project_id)
  )
)
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and exists (
    select 1 from public.actions a
    where a.id = action_external_stakeholders.action_id
      and is_project_member(a.project_id)
  )
);

-- gestor_faus: apenas leitura
create policy "aes: gestor_faus leitura"
on public.action_external_stakeholders
for select
using (
  get_user_role() = 'gestor_faus'::public.user_role
);

-- cliente: leitura para ações visíveis do próprio projeto
create policy "aes: cliente leitura acoes visiveis"
on public.action_external_stakeholders
for select
using (
  get_user_role() = 'cliente'::public.user_role
  and exists (
    select 1
    from public.actions a
    join public.projects p on p.id = a.project_id
    join public.profiles pr on pr.id = auth.uid()
    where a.id = action_external_stakeholders.action_id
      and a.visible_to_client = true
      and pr.client_id = p.client_id
      and pr.is_active = true
  )
);
