alter table public.recurring_expenses
  add column if not exists shared_with_nicol boolean not null default false;

comment on column public.recurring_expenses.shared_with_nicol is
  'Incluye este gasto recurrente activo en el enlace público de Nicol. Falso por defecto.';

create index if not exists recurring_expenses_nicol_shared_idx
  on public.recurring_expenses (user_id, day_of_month, name)
  where kind = 'expense' and active = true and shared_with_nicol = true;

create or replace function public.get_nicol_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link public.billing_share_links%rowtype;
  v_cycles jsonb := '[]'::jsonb;
  v_recurring_transactions jsonb := '[]'::jsonb;
  v_billing_total bigint := 0;
  v_recurring_total bigint := 0;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return jsonb_build_object('ok', false, 'message', 'El enlace no existe o fue desactivado.');
  end if;

  select link.*
    into v_link
    from public.billing_share_links as link
   where link.active = true
     and link.label = 'Nicol'
     and link.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   limit 1;

  if v_link.id is null then
    return jsonb_build_object('ok', false, 'message', 'El enlace no existe o fue desactivado.');
  end if;

  with eligible as (
    select
      tx.id as transaction_id,
      tx.billing_cycle_id,
      tx.transaction_date,
      tx.description,
      tx.movement_type,
      tx.amount,
      tx.created_at
    from public.billing_transactions as tx
    where tx.user_id = v_link.user_id
      and tx.shared_with_nicol = true
      and tx.affects_cycle_total = true
      and tx.amount > 0
      and tx.movement_type not in ('payment', 'credit')
  ),
  cycle_rows as (
    select
      cycle.cycle_key,
      cycle.period_start,
      cycle.period_end,
      cycle.due_date,
      cycle.status,
      sum(item.amount)::bigint as shared_total,
      jsonb_agg(
        jsonb_build_object(
          'id', item.transaction_id,
          'date', item.transaction_date,
          'description', item.description,
          'movementType', item.movement_type,
          'amount', item.amount
        )
        order by item.transaction_date desc nulls last, item.created_at desc
      ) as transactions
    from public.billing_cycles as cycle
    join eligible as item on item.billing_cycle_id = cycle.id
    where cycle.user_id = v_link.user_id
    group by cycle.id, cycle.cycle_key, cycle.period_start, cycle.period_end, cycle.due_date, cycle.status
    order by cycle.cycle_key desc, cycle.due_date desc
    limit 24
  ),
  payload as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'cycleKey', row.cycle_key,
            'periodStart', row.period_start,
            'periodEnd', row.period_end,
            'dueDate', row.due_date,
            'status', row.status,
            'sharedTotal', row.shared_total,
            'nicolAmount', round(row.shared_total * v_link.percentage / 100.0)::bigint,
            'transactions', row.transactions
          )
          order by row.cycle_key desc, row.due_date desc
        ),
        '[]'::jsonb
      ) as cycles,
      coalesce(sum(row.shared_total), 0)::bigint as grand_total
    from cycle_rows as row
  )
  select result.cycles, result.grand_total
    into v_cycles, v_billing_total
    from payload as result;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', recurring.id,
          'date', current_date,
          'description', recurring.name,
          'movementType', 'other',
          'amount', recurring.amount
        )
        order by recurring.day_of_month nulls last, recurring.name
      ),
      '[]'::jsonb
    ),
    coalesce(sum(recurring.amount), 0)::bigint
    into v_recurring_transactions, v_recurring_total
    from public.recurring_expenses as recurring
   where recurring.user_id = v_link.user_id
     and recurring.kind = 'expense'
     and recurring.active = true
     and recurring.shared_with_nicol = true
     and recurring.amount > 0;

  if v_recurring_total > 0 then
    v_cycles := jsonb_build_array(
      jsonb_build_object(
        'cycleKey', 'Recurrentes',
        'periodStart', date_trunc('month', current_date)::date,
        'periodEnd', (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
        'dueDate', null,
        'status', 'in_progress',
        'sharedTotal', v_recurring_total,
        'nicolAmount', round(v_recurring_total * v_link.percentage / 100.0)::bigint,
        'transactions', v_recurring_transactions
      )
    ) || v_cycles;
  end if;

  return jsonb_build_object(
    'ok', true,
    'label', v_link.label,
    'percentage', v_link.percentage,
    'cycles', v_cycles,
    'recurringSharedTotal', v_recurring_total,
    'recurringNicolAmount', round(v_recurring_total * v_link.percentage / 100.0)::bigint,
    'grandSharedTotal', v_billing_total + v_recurring_total,
    'grandNicolAmount', round((v_billing_total + v_recurring_total) * v_link.percentage / 100.0)::bigint
  );
end;
$function$;