create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  faus_people text[] not null default '{}',
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint diary_entries_valid_period check (end_date >= start_date),
  constraint diary_entries_has_people check (cardinality(faus_people) > 0)
);

create table if not exists public.diary_deliverables (
  id uuid primary key default gen_random_uuid(),
  diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
  description text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint diary_deliverables_description_not_blank check (length(btrim(description)) > 0)
);

create index if not exists diary_entries_project_id_idx on public.diary_entries(project_id);
create index if not exists diary_entries_start_date_idx on public.diary_entries(start_date);
create index if not exists diary_entries_deleted_at_idx on public.diary_entries(deleted_at);
create index if not exists diary_deliverables_entry_id_idx on public.diary_deliverables(diary_entry_id);

drop trigger if exists set_diary_entries_updated_at on public.diary_entries;
create trigger set_diary_entries_updated_at
before update on public.diary_entries
for each row
execute function public.set_updated_at();

create or replace function public.prevent_non_admin_diary_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin_faus'
      and p.is_active = true
  ) then
    raise exception 'Apenas admin_faus pode excluir registros do Diário de Bordo.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_admin_diary_soft_delete on public.diary_entries;
create trigger prevent_non_admin_diary_soft_delete
before update on public.diary_entries
for each row
execute function public.prevent_non_admin_diary_soft_delete();

alter table public.diary_entries enable row level security;
alter table public.diary_deliverables enable row level security;

drop policy if exists "diary_entries_internal_read" on public.diary_entries;
create policy "diary_entries_internal_read"
on public.diary_entries
for select
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
      and (
        p.role::text = 'admin_faus'
        or pr.main_consultant_id = p.id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = p.id
        )
      )
  )
);

drop policy if exists "diary_entries_internal_insert" on public.diary_entries;
create policy "diary_entries_internal_insert"
on public.diary_entries
for insert
with check (
  deleted_at is null
  and created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
      and (
        p.role::text = 'admin_faus'
        or pr.main_consultant_id = p.id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = p.id
        )
      )
  )
);

drop policy if exists "diary_entries_internal_update" on public.diary_entries;
create policy "diary_entries_internal_update"
on public.diary_entries
for update
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
      and (
        p.role::text = 'admin_faus'
        or pr.main_consultant_id = p.id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = p.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.projects pr on pr.id = diary_entries.project_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
      and (
        p.role::text = 'admin_faus'
        or pr.main_consultant_id = p.id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = pr.id
            and pm.user_id = p.id
        )
      )
  )
);

drop policy if exists "diary_entries_admin_delete" on public.diary_entries;
create policy "diary_entries_admin_delete"
on public.diary_entries
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin_faus'
      and p.is_active = true
  )
);

drop policy if exists "diary_deliverables_internal_read" on public.diary_deliverables;
create policy "diary_deliverables_internal_read"
on public.diary_deliverables
for select
using (
  exists (
    select 1
    from public.diary_entries de
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and exists (
        select 1
        from public.profiles p
        join public.projects pr on pr.id = de.project_id
        where p.id = auth.uid()
          and p.is_active = true
          and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
          and (
            p.role::text = 'admin_faus'
            or pr.main_consultant_id = p.id
            or exists (
              select 1
              from public.project_members pm
              where pm.project_id = pr.id
                and pm.user_id = p.id
            )
          )
      )
  )
);

drop policy if exists "diary_deliverables_internal_write" on public.diary_deliverables;
create policy "diary_deliverables_internal_write"
on public.diary_deliverables
for all
using (
  exists (
    select 1
    from public.diary_entries de
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and exists (
        select 1
        from public.profiles p
        join public.projects pr on pr.id = de.project_id
        where p.id = auth.uid()
          and p.is_active = true
          and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
          and (
            p.role::text = 'admin_faus'
            or pr.main_consultant_id = p.id
            or exists (
              select 1
              from public.project_members pm
              where pm.project_id = pr.id
                and pm.user_id = p.id
            )
          )
      )
  )
)
with check (
  exists (
    select 1
    from public.diary_entries de
    where de.id = diary_deliverables.diary_entry_id
      and de.deleted_at is null
      and exists (
        select 1
        from public.profiles p
        join public.projects pr on pr.id = de.project_id
        where p.id = auth.uid()
          and p.is_active = true
          and p.role::text in ('admin_faus', 'consultor', 'consultor_faus')
          and (
            p.role::text = 'admin_faus'
            or pr.main_consultant_id = p.id
            or exists (
              select 1
              from public.project_members pm
              where pm.project_id = pr.id
                and pm.user_id = p.id
            )
          )
      )
  )
);
