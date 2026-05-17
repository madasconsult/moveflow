-- Rodada 4I - Blindagem estrutural dos KPIs por trigger.
--
-- Objetivo:
-- - Permitir que o Consultor Principal siga operando/apurando KPIs.
-- - Impedir alteracao direta de campos estruturais de KPIs existentes por nao-admin.
-- - Preservar INSERT de novos KPIs conforme RLS da Rodada 4H.
--
-- Observacao:
-- - kpi_target_periods ja permanece admin-only pela RLS da Rodada 4H.
-- - kpi_period_records concentra apuracoes operacionais e nao e bloqueada por esta trigger.
-- - target_value e status permanecem livres para atualizacao do resumo operacional
--   do KPI durante a apuracao dos periodos.

create or replace function public.protect_kpi_structural_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_faus boolean;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text = 'admin_faus'
  )
  into is_admin_faus;

  if is_admin_faus then
    return new;
  end if;

  if
    new.project_id is distinct from old.project_id
    or new.kpi_name is distinct from old.kpi_name
    or new.category is distinct from old.category
    or new.description is distinct from old.description
    or new.classification is distinct from old.classification
    or new.unit_of_measure is distinct from old.unit_of_measure
    or new.update_frequency is distinct from old.update_frequency
    or new.responsible_id is distinct from old.responsible_id
    or new.reading_type is distinct from old.reading_type
    or new.origin_type is distinct from old.origin_type
    or new.diagnosis_indicator_id is distinct from old.diagnosis_indicator_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Campos estruturais de KPI só podem ser alterados por Admin FAUS.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_kpi_structural_fields_trigger on public.kpis;

create trigger protect_kpi_structural_fields_trigger
before update on public.kpis
for each row
execute function public.protect_kpi_structural_fields();
