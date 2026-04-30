create table if not exists public.action_steps (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id) on delete cascade,
  title text not null,
  description text null,
  status public.action_status not null default 'not_started',
  due_date date null,
  completion_date timestamptz null,
  sort_order integer null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_steps_action_id_idx on public.action_steps(action_id);
create index if not exists action_steps_status_idx on public.action_steps(status);
create index if not exists action_steps_due_date_idx on public.action_steps(due_date);

drop trigger if exists set_action_steps_updated_at on public.action_steps;
create trigger set_action_steps_updated_at
before update on public.action_steps
for each row
execute function public.handle_updated_at();

alter table public.action_steps enable row level security;

drop policy if exists "action_steps_internal_read" on public.action_steps;
create policy "action_steps_internal_read"
on public.action_steps
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
    from public.actions a
    where a.id = action_steps.action_id
  )
);

drop policy if exists "action_steps_internal_write" on public.action_steps;
create policy "action_steps_internal_write"
on public.action_steps
for all
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
    from public.actions a
    where a.id = action_steps.action_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin_faus', 'consultor_faus')
      and p.is_active = true
  )
  and exists (
    select 1
    from public.actions a
    where a.id = action_steps.action_id
  )
);
