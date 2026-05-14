-- Rodada 4B - Banco base, enums e campos estruturais.
-- Esta migration cria apenas a fundacao estrutural para perfis, filiais,
-- tipos de projeto, gestor do projeto e especialidades de consultores.

do $$
begin
  create type public.faus_branch as enum (
    'matriz',
    'mg',
    'sao_paulo_capital',
    'ne'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'faus_branch'
      and e.enumlabel = 'matriz'
  ) then
    alter type public.faus_branch add value 'matriz';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'faus_branch'
      and e.enumlabel = 'mg'
  ) then
    alter type public.faus_branch add value 'mg';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'faus_branch'
      and e.enumlabel = 'sao_paulo_capital'
  ) then
    alter type public.faus_branch add value 'sao_paulo_capital';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'faus_branch'
      and e.enumlabel = 'ne'
  ) then
    alter type public.faus_branch add value 'ne';
  end if;
end $$;

do $$
begin
  create type public.project_type_enum as enum (
    'consultoria',
    'inteligencia_de_dados',
    'wms',
    'tms_roteirizador'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_type_enum'
      and e.enumlabel = 'consultoria'
  ) then
    alter type public.project_type_enum add value 'consultoria';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_type_enum'
      and e.enumlabel = 'inteligencia_de_dados'
  ) then
    alter type public.project_type_enum add value 'inteligencia_de_dados';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_type_enum'
      and e.enumlabel = 'wms'
  ) then
    alter type public.project_type_enum add value 'wms';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_type_enum'
      and e.enumlabel = 'tms_roteirizador'
  ) then
    alter type public.project_type_enum add value 'tms_roteirizador';
  end if;
end $$;

do $$
begin
  create type public.project_specialty as enum (
    'armazem',
    'transportes',
    'compras',
    'comercial',
    'inteligencia_de_dados',
    'wms',
    'tms_roteirizador',
    'planejamento',
    'gestao',
    'mapeamento_de_processos',
    'multidisciplinar'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'armazem'
  ) then
    alter type public.project_specialty add value 'armazem';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'transportes'
  ) then
    alter type public.project_specialty add value 'transportes';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'compras'
  ) then
    alter type public.project_specialty add value 'compras';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'comercial'
  ) then
    alter type public.project_specialty add value 'comercial';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'inteligencia_de_dados'
  ) then
    alter type public.project_specialty add value 'inteligencia_de_dados';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'wms'
  ) then
    alter type public.project_specialty add value 'wms';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'tms_roteirizador'
  ) then
    alter type public.project_specialty add value 'tms_roteirizador';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'planejamento'
  ) then
    alter type public.project_specialty add value 'planejamento';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'gestao'
  ) then
    alter type public.project_specialty add value 'gestao';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'mapeamento_de_processos'
  ) then
    alter type public.project_specialty add value 'mapeamento_de_processos';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'project_specialty'
      and e.enumlabel = 'multidisciplinar'
  ) then
    alter type public.project_specialty add value 'multidisciplinar';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
      and e.enumlabel = 'gestor_faus'
  ) then
    alter type public.user_role add value 'gestor_faus';
  end if;
end $$;

alter table public.profiles
  add column if not exists branch public.faus_branch null;

alter table public.projects
  add column if not exists project_type public.project_type_enum null,
  add column if not exists branch public.faus_branch null,
  add column if not exists project_manager_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.projects'::regclass
      and c.contype = 'f'
      and a.attname = 'project_manager_id'
  ) then
    alter table public.projects
      add constraint projects_project_manager_id_fkey
      foreign key (project_manager_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

alter table public.project_members
  add column if not exists specialty public.project_specialty null;

create index if not exists profiles_branch_idx
  on public.profiles(branch);

create index if not exists projects_project_type_idx
  on public.projects(project_type);

create index if not exists projects_branch_idx
  on public.projects(branch);

create index if not exists projects_project_manager_id_idx
  on public.projects(project_manager_id);

create index if not exists project_members_specialty_idx
  on public.project_members(specialty);
