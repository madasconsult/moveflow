create sequence if not exists public.actions_business_id_seq start 1;

alter table public.actions
add column if not exists business_id text;

create or replace function public.assign_action_business_id()
returns trigger
language plpgsql
as $$
begin
  if new.business_id is null or btrim(new.business_id) = '' then
    new.business_id := 'ACT-' || lpad(nextval('public.actions_business_id_seq')::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists set_actions_business_id on public.actions;
create trigger set_actions_business_id
before insert on public.actions
for each row
execute function public.assign_action_business_id();

with ranked_actions as (
  select
    id,
    'ACT-' || lpad(row_number() over (order by created_at, id)::text, 6, '0') as next_business_id
  from public.actions
)
update public.actions a
set business_id = ranked_actions.next_business_id
from ranked_actions
where a.id = ranked_actions.id
  and (a.business_id is null or btrim(a.business_id) = '');

select setval(
  'public.actions_business_id_seq',
  greatest((select count(*) from public.actions), 1),
  (select count(*) from public.actions) > 0
);

create unique index if not exists actions_business_id_idx on public.actions (business_id);
