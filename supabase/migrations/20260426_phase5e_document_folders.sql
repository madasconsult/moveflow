create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_name text not null,
  parent_folder_id uuid null references public.document_folders(id) on delete cascade,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_folders_unique_name_per_parent unique (project_id, parent_folder_id, folder_name)
);

alter table public.documents
add column if not exists folder_id uuid null references public.document_folders(id) on delete set null;

create index if not exists document_folders_project_id_idx on public.document_folders(project_id);
create index if not exists document_folders_parent_folder_id_idx on public.document_folders(parent_folder_id);
create index if not exists documents_folder_id_idx on public.documents(folder_id);

drop trigger if exists set_document_folders_updated_at on public.document_folders;
create trigger set_document_folders_updated_at
before update on public.document_folders
for each row
execute function public.handle_updated_at();

alter table public.document_folders enable row level security;

drop policy if exists "document_folders_internal_read" on public.document_folders;
create policy "document_folders_internal_read"
on public.document_folders
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = document_folders.project_id
  )
);

drop policy if exists "document_folders_internal_write" on public.document_folders;
create policy "document_folders_internal_write"
on public.document_folders
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin_faus'
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = document_folders.project_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin_faus'
      and p.is_active = true
  )
  and exists (
    select 1
    from public.projects pr
    where pr.id = document_folders.project_id
  )
);
