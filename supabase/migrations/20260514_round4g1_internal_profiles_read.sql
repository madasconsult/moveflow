drop policy if exists "profiles: internos leem perfis internos ativos" on public.profiles;

create policy "profiles: internos leem perfis internos ativos"
on public.profiles
for select
using (
  public.get_user_role() in (
    'admin_faus'::public.user_role,
    'gestor_faus'::public.user_role,
    'consultor_faus'::public.user_role
  )
  and role in (
    'admin_faus'::public.user_role,
    'gestor_faus'::public.user_role,
    'consultor_faus'::public.user_role
  )
  and is_active = true
);
