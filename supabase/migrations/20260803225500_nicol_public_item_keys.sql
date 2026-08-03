-- Clave técnica para el render de React. No corresponde a usuario, tarjeta ni banco.
create or replace function public.get_nicol_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.billing_share_links%rowtype;
  v_cycles jsonb := '[]'::jsonb;
  v_grand_total bigint := 0;
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
    into v_cycles, v_grand_total
    from payload as result;

  return jsonb_build_object(
    'ok', true,
    'label', v_link.label,
    'percentage', v_link.percentage,
    'cycles', v_cycles,
    'grandSharedTotal', v_grand_total,
    'grandNicolAmount', round(v_grand_total * v_link.percentage / 100.0)::bigint
  );
end;
$$;

revoke execute on function public.get_nicol_share(text) from public, anon, authenticated;
grant execute on function public.get_nicol_share(text) to anon, authenticated;
