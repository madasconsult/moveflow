-- Round 4J: diary_deliverables status, completion date, notes, and carry-over tracking.
-- All new columns are nullable or have safe defaults to preserve existing data.
-- Idempotent via ADD COLUMN IF NOT EXISTS.

alter table public.diary_deliverables
  add column if not exists status text null,
  add column if not exists completion_date date null,
  add column if not exists notes text null,
  add column if not exists origin_deliverable_id uuid null
    references public.diary_deliverables(id) on delete set null,
  add column if not exists carried_from_diary_entry_id uuid null
    references public.diary_entries(id) on delete set null,
  add column if not exists is_carried_over boolean not null default false;

-- Constraint: valid status values (null is allowed for legacy rows)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'diary_deliverables_status_check'
      and n.nspname = 'public'
      and t.relname = 'diary_deliverables'
  ) then
    alter table public.diary_deliverables
      add constraint diary_deliverables_status_check
        check (status is null or status in ('completed', 'partial', 'pending'));
  end if;
end $$;

-- Index: look up carry-over children of an origin deliverable
create index if not exists diary_deliverables_origin_id_idx
  on public.diary_deliverables(origin_deliverable_id)
  where origin_deliverable_id is not null;

-- Index: look up all carry-overs that came from a specific entry
create index if not exists diary_deliverables_carried_from_idx
  on public.diary_deliverables(carried_from_diary_entry_id)
  where carried_from_diary_entry_id is not null;

-- Index: fast scan for pending/partial deliverables per entry (used when creating new visits)
create index if not exists diary_deliverables_pending_partial_idx
  on public.diary_deliverables(diary_entry_id, status)
  where status = 'pending' or status = 'partial';
