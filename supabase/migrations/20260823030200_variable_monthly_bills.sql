-- Permite que las cuentas variables (por ejemplo luz/agua) se modelen como
-- cuentas por pagar de un mes concreto, sin copiar el mismo monto a meses futuros.
--
-- Los gastos kind='expense' siguen funcionando como recurrentes mensuales.
-- Los registros kind='payable' compartidos con Nicol aparecen solo en el mes
-- de su due_date y quedan disponibles en el historial de ese mes.

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.get_nicol_share_cycles_calendar_base(text)'::regprocedure)
    into v_def;

  v_old := $old$
  month_keys as (
    select cycle_key from actual_items
    union
    select cycle_key from projected_items
    union
    select cycle_key from future_months
  ),
$old$;

  v_new := $new$
  month_keys as (
    select cycle_key from actual_items
    union
    select cycle_key from projected_items
    union
    select cycle_key from future_months
    union
    select to_char(recurring.due_date, 'YYYY-MM')
      from public.recurring_expenses as recurring
     where recurring.user_id = v_link.user_id
       and recurring.kind = 'payable'
       and recurring.active = true
       and recurring.shared_with_nicol = true
       and recurring.amount > 0
       and recurring.due_date is not null
  ),
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró month_keys esperado en get_nicol_share_cycles_calendar_base';
  end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
      null::date as transaction_date,
      recurring.name as description,
      'other'::text as movement_type,
      recurring.amount::bigint as amount,
      null::bigint as original_amount,
      null::integer as installment_current,
      null::integer as installment_total,
      month.cycle_key > v_current_key as is_projected,
      true as is_recurring,
$old$;

  v_new := $new$
      case when recurring.kind = 'payable' then recurring.due_date else null::date end as transaction_date,
      recurring.name as description,
      'other'::text as movement_type,
      recurring.amount::bigint as amount,
      null::bigint as original_amount,
      null::integer as installment_current,
      null::integer as installment_total,
      month.cycle_key > v_current_key as is_projected,
      (recurring.kind = 'expense') as is_recurring,
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró bloque de recurrentes esperado en get_nicol_share_cycles_calendar_base';
  end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
    where recurring.user_id = v_link.user_id
      and recurring.kind = 'expense'
      and recurring.active = true
      and recurring.shared_with_nicol = true
      and recurring.amount > 0
      and month.cycle_key >= v_current_key
$old$;

  v_new := $new$
    where recurring.user_id = v_link.user_id
      and recurring.kind in ('expense', 'payable')
      and recurring.active = true
      and recurring.shared_with_nicol = true
      and recurring.amount > 0
      and (
        (recurring.kind = 'expense' and month.cycle_key >= v_current_key)
        or
        (recurring.kind = 'payable'
          and recurring.due_date is not null
          and month.cycle_key = to_char(recurring.due_date, 'YYYY-MM'))
      )
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró filtro de recurrentes esperado en get_nicol_share_cycles_calendar_base';
  end if;
  v_def := replace(v_def, v_old, v_new);

  execute v_def;
end;
$$;
