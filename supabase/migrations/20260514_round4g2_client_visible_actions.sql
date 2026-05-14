drop policy if exists "actions: cliente le acoes visiveis do proprio projeto" on public.actions;

create policy "actions: cliente le acoes visiveis do proprio projeto"
on public.actions
for select
using (
  public.get_user_role() = 'cliente'::public.user_role
  and visible_to_client = true
  and exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = auth.uid()
    where p.id = actions.project_id
      and pr.client_id = p.client_id
      and pr.is_active = true
      and pr.role = 'cliente'::public.user_role
  )
);
