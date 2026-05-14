create or replace function public.protect_original_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  protected_admin_id constant uuid := '8ba21d13-8ceb-4695-b591-126ff320e6f8';
  protected_admin_error constant text := 'O Admin Original do MOVE FLOW não pode ser rebaixado, desativado, vinculado a cliente ou excluído.';
begin
  if tg_op = 'DELETE' then
    if old.id = protected_admin_id then
      raise exception '%', protected_admin_error;
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.id = protected_admin_id then
      if new.id <> old.id
        or new.role::text <> 'admin_faus'
        or new.is_active is distinct from true
        or new.client_id is not null
      then
        raise exception '%', protected_admin_error;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_original_admin_profile_trigger on public.profiles;

create trigger protect_original_admin_profile_trigger
before update or delete on public.profiles
for each row
execute function public.protect_original_admin_profile();
