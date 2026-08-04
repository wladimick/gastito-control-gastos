create or replace function public.get_nicol_share_cycles(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link public.billing_share_links%rowtype;
  v_cycles jsonb := '[]'::jsonb;
  v_current_key text := to_char(current_date, 'YYYY-MM');
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

  with actual_items as (
    select
      tx.id::text as item_id,
      cycle.cycle_key,
      cycle.period_start,
      cycle.period_end,
      cycle.due_date,
      tx.transaction_date,
      tx.description,
      tx.movement_type,
      tx.amount::bigint as amount,
      tx.installment_current,
      tx.installment_total,
      false as is_projected,
      false as is_recurring,
      tx.created_at
    from public.billing_transactions as tx
    join public.billing_cycles as cycle on cycle.id = tx.billing_cycle_id
    where tx.user_id = v_link.user_id
      and cycle.user_id = v_link.user_id
      and tx.shared_with_nicol = true
      and tx.affects_cycle_total = true
      and tx.amount > 0
      and tx.movement_type not in ('payment', 'credit')
  ),
  projected_seed as (
    select
      tx.id::text || ':projection:' || step.n::text as item_id,
      to_char(
        to_date(cycle.cycle_key || '-01', 'YYYY-MM-DD') + make_interval(months => step.n),
        'YYYY-MM'
      ) as cycle_key,
      (cycle.period_start + make_interval(months => step.n))::date as period_start,
      (cycle.period_end + make_interval(months => step.n))::date as period_end,
      (cycle.due_date + make_interval(months => step.n))::date as due_date,
      null::date as transaction_date,
      tx.description,
      tx.movement_type,
      tx.amount::bigint as amount,
      tx.installment_current + step.n as installment_current,
      tx.installment_total,
      true as is_projected,
      false as is_recurring,
      tx.created_at,
      row_number() over (
        partition by
          to_char(to_date(cycle.cycle_key || '-01', 'YYYY-MM-DD') + make_interval(months => step.n), 'YYYY-MM'),
          upper(trim(tx.description)),
          tx.amount,
          tx.installment_current + step.n,
          tx.installment_total
        order by cycle.cycle_key desc, tx.installment_current desc, tx.created_at desc
      ) as projection_rank
    from public.billing_transactions as tx
    join public.billing_cycles as cycle on cycle.id = tx.billing_cycle_id
    cross join lateral generate_series(
      1,
      least(greatest(coalesce(tx.installment_total, 0) - coalesce(tx.installment_current, 0), 0), 24)
    ) as step(n)
    where tx.user_id = v_link.user_id
      and cycle.user_id = v_link.user_id
      and tx.shared_with_nicol = true
      and tx.affects_cycle_total = true
      and tx.amount > 0
      and tx.movement_type = 'installment'
      and tx.installment_current is not null
      and tx.installment_total is not null
      and tx.installment_current < tx.installment_total
  ),
  projected_items as (
    select seed.item_id, seed.cycle_key, seed.period_start, seed.period_end, seed.due_date,
           seed.transaction_date, seed.description, seed.movement_type, seed.amount,
           seed.installment_current, seed.installment_total, seed.is_projected,
           seed.is_recurring, seed.created_at
    from projected_seed as seed
    where seed.projection_rank = 1
      and not exists (
        select 1
        from actual_items as actual
        where actual.cycle_key = seed.cycle_key
          and actual.movement_type = 'installment'
          and upper(trim(actual.description)) = upper(trim(seed.description))
          and actual.amount = seed.amount
          and actual.installment_current = seed.installment_current
          and actual.installment_total = seed.installment_total
      )
  ),
  cycle_metadata as (
    select
      cycle.cycle_key,
      min(cycle.period_start) as period_start,
      max(cycle.period_end) as period_end,
      min(cycle.due_date) as due_date,
      case
        when bool_or(cycle.status = 'in_progress') then 'in_progress'
        when bool_or(cycle.status = 'partial') then 'partial'
        when bool_or(cycle.status = 'paid') then 'paid'
        else 'closed'
      end as status
    from public.billing_cycles as cycle
    where cycle.user_id = v_link.user_id
    group by cycle.cycle_key
  ),
  future_months as (
    select to_char(month_start::date, 'YYYY-MM') as cycle_key
    from generate_series(
      date_trunc('month', current_date),
      date_trunc('month', current_date) + interval '5 months',
      interval '1 month'
    ) as month_start
  ),
  month_keys as (
    select cycle_key from actual_items
    union
    select cycle_key from projected_items
    union
    select cycle_key from future_months
  ),
  recurring_items as (
    select
      recurring.id::text || ':recurring:' || month.cycle_key as item_id,
      month.cycle_key,
      null::date as period_start,
      null::date as period_end,
      null::date as due_date,
      null::date as transaction_date,
      recurring.name as description,
      'other'::text as movement_type,
      recurring.amount::bigint as amount,
      null::integer as installment_current,
      null::integer as installment_total,
      month.cycle_key > v_current_key as is_projected,
      true as is_recurring,
      recurring.created_at
    from public.recurring_expenses as recurring
    cross join month_keys as month
    where recurring.user_id = v_link.user_id
      and recurring.kind = 'expense'
      and recurring.active = true
      and recurring.shared_with_nicol = true
      and recurring.amount > 0
      and month.cycle_key >= v_current_key
  ),
  all_items as (
    select * from actual_items
    union all
    select * from projected_items
    union all
    select * from recurring_items
  ),
  cycle_rows as (
    select
      month.cycle_key,
      coalesce(meta.period_start, to_date(month.cycle_key || '-01', 'YYYY-MM-DD')) as period_start,
      coalesce(
        meta.period_end,
        (to_date(month.cycle_key || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date
      ) as period_end,
      meta.due_date,
      case
        when month.cycle_key > v_current_key then 'upcoming'
        when month.cycle_key = v_current_key then coalesce(meta.status, 'in_progress')
        else coalesce(meta.status, 'closed')
      end as status,
      month.cycle_key > v_current_key as is_upcoming,
      month.cycle_key = v_current_key as is_current,
      coalesce(sum(item.amount), 0)::bigint as shared_total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', item.item_id,
            'date', item.transaction_date,
            'description', item.description,
            'movementType', item.movement_type,
            'amount', item.amount,
            'installmentCurrent', item.installment_current,
            'installmentTotal', item.installment_total,
            'isProjected', item.is_projected,
            'isRecurring', item.is_recurring
          )
          order by item.is_recurring, item.is_projected, item.transaction_date desc nulls last, item.created_at desc
        ) filter (where item.item_id is not null),
        '[]'::jsonb
      ) as transactions,
      count(item.item_id) filter (where item.is_projected and not item.is_recurring) as projected_count,
      count(item.item_id) filter (where item.is_recurring) as recurring_count
    from month_keys as month
    left join cycle_metadata as meta on meta.cycle_key = month.cycle_key
    left join all_items as item on item.cycle_key = month.cycle_key
    group by month.cycle_key, meta.period_start, meta.period_end, meta.due_date, meta.status
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cycleKey', row.cycle_key,
        'periodStart', row.period_start,
        'periodEnd', row.period_end,
        'dueDate', row.due_date,
        'status', row.status,
        'isUpcoming', row.is_upcoming,
        'isCurrent', row.is_current,
        'sharedTotal', row.shared_total,
        'nicolAmount', round(row.shared_total * v_link.percentage / 100.0)::bigint,
        'projectedCount', row.projected_count,
        'recurringCount', row.recurring_count,
        'transactions', row.transactions
      )
      order by row.cycle_key
    ),
    '[]'::jsonb
  )
  into v_cycles
  from cycle_rows as row;

  return jsonb_build_object(
    'ok', true,
    'label', v_link.label,
    'percentage', v_link.percentage,
    'currentCycleKey', v_current_key,
    'cycles', v_cycles
  );
end;
$function$;

revoke all on function public.get_nicol_share_cycles(text) from public;
grant execute on function public.get_nicol_share_cycles(text) to anon, authenticated;
