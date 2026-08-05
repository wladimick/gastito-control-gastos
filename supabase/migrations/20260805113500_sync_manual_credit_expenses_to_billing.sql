create extension if not exists pgcrypto;

alter table public.billing_transactions
  add column if not exists manual_expense_id uuid
  references public.expenses(id) on delete cascade;

create unique index if not exists billing_transactions_manual_expense_unique
  on public.billing_transactions(manual_expense_id)
  where manual_expense_id is not null;

create or replace function public.gastito_clamped_date(
  p_year integer,
  p_month integer,
  p_day integer
)
returns date
language sql
immutable
strict
as $$
  select make_date(
    p_year,
    p_month,
    least(
      greatest(p_day, 1),
      extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::integer
    )
  );
$$;

create or replace function public.refresh_one_billing_cycle_estimate(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_cycle_id is null then
    return;
  end if;

  update public.billing_cycles cycle
  set estimated_amount = greatest(
        cycle.reported_amount,
        coalesce((
          select sum(transaction.amount)
          from public.billing_transactions transaction
          where transaction.billing_cycle_id = p_cycle_id
            and transaction.affects_cycle_total = true
        ), 0)
      ),
      reconciliation_status = case
        when cycle.reported_amount_is_final then cycle.reconciliation_status
        when cycle.reconciliation_status = 'reconciled' then 'partial'
        else cycle.reconciliation_status
      end,
      updated_at = now()
  where cycle.id = p_cycle_id;
end;
$$;

create or replace function public.refresh_billing_cycle_estimate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_one_billing_cycle_estimate(old.billing_cycle_id);
    return old;
  end if;

  perform public.refresh_one_billing_cycle_estimate(new.billing_cycle_id);

  if tg_op = 'UPDATE'
     and old.billing_cycle_id is distinct from new.billing_cycle_id then
    perform public.refresh_one_billing_cycle_estimate(old.billing_cycle_id);
  end if;

  return new;
end;
$$;

drop trigger if exists billing_transactions_refresh_cycle_estimate
  on public.billing_transactions;

create trigger billing_transactions_refresh_cycle_estimate
after insert or update of amount, affects_cycle_total, billing_cycle_id or delete
on public.billing_transactions
for each row
execute function public.refresh_billing_cycle_estimate();

create or replace function public.sync_manual_credit_expense_to_billing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.credit_cards%rowtype;
  v_expense_day date;
  v_period_end_anchor date;
  v_period_start_anchor date;
  v_due_anchor date;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_cycle_key text;
  v_cycle_id uuid;
  v_installment_total integer;
  v_installment_amount integer;
begin
  delete from public.billing_transactions
  where manual_expense_id = new.id;

  if new.card_type is distinct from 'credito'
     or new.payment_method_id is distinct from 'tarjeta'
     or new.amount <= 0 then
    return new;
  end if;

  select card.*
  into v_card
  from public.credit_cards card
  where card.user_id = new.user_id
    and card.bank_id = new.bank_id
    and card.is_active = true
  order by card.created_at
  limit 1;

  if not found then
    return new;
  end if;

  v_expense_day := (new.expense_date at time zone 'America/Santiago')::date;

  if extract(day from v_expense_day)::integer >= coalesce(v_card.billing_start_day, v_card.billing_day + 1) then
    v_period_end_anchor := (date_trunc('month', v_expense_day)::date + interval '1 month')::date;
  else
    v_period_end_anchor := date_trunc('month', v_expense_day)::date;
  end if;

  v_period_end := public.gastito_clamped_date(
    extract(year from v_period_end_anchor)::integer,
    extract(month from v_period_end_anchor)::integer,
    v_card.billing_day
  );

  v_period_start_anchor := (date_trunc('month', v_period_end)::date - interval '1 month')::date;
  v_period_start := public.gastito_clamped_date(
    extract(year from v_period_start_anchor)::integer,
    extract(month from v_period_start_anchor)::integer,
    coalesce(v_card.billing_start_day, v_card.billing_day + 1)
  );

  v_due_anchor := (date_trunc('month', v_period_end)::date + interval '1 month')::date;
  v_due_date := public.gastito_clamped_date(
    extract(year from v_due_anchor)::integer,
    extract(month from v_due_anchor)::integer,
    v_card.payment_due_day
  );
  v_cycle_key := to_char(v_due_date, 'YYYY-MM');

  insert into public.billing_cycles (
    user_id,
    credit_card_id,
    cycle_key,
    period_start,
    period_end,
    closing_date,
    due_date,
    status,
    reported_amount,
    reported_amount_is_final,
    estimated_amount,
    reconciliation_status,
    source_file,
    notes
  ) values (
    new.user_id,
    v_card.id,
    v_cycle_key,
    v_period_start,
    v_period_end,
    v_period_end,
    v_due_date,
    case when v_due_date < current_date then 'closed' else 'in_progress' end,
    0,
    false,
    0,
    'partial',
    'Gastito · gastos manuales',
    'Ciclo actualizado automáticamente desde gastos registrados con tarjeta de crédito.'
  )
  on conflict (user_id, credit_card_id, cycle_key)
  do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    closing_date = excluded.closing_date,
    due_date = excluded.due_date,
    updated_at = now()
  returning id into v_cycle_id;

  v_installment_total := greatest(coalesce(new.installments_count, 1), 1);
  v_installment_amount := case
    when v_installment_total > 1 then round(new.amount::numeric / v_installment_total)::integer
    else new.amount
  end;

  insert into public.billing_transactions (
    user_id,
    billing_cycle_id,
    credit_card_id,
    bank_id,
    transaction_date,
    description,
    movement_type,
    amount,
    original_amount,
    installment_current,
    installment_total,
    installments_remaining,
    currency,
    affects_cycle_total,
    is_pending,
    review_status,
    source_file,
    source_kind,
    stable_hash,
    raw_metadata,
    category_id,
    manual_expense_id
  ) values (
    new.user_id,
    v_cycle_id,
    v_card.id,
    new.bank_id,
    v_expense_day,
    new.description,
    case when v_installment_total > 1 then 'installment' else 'purchase' end,
    v_installment_amount,
    new.amount,
    1,
    v_installment_total,
    v_installment_total - 1,
    'CLP',
    true,
    false,
    'verified',
    'Gastito · gasto manual',
    'manual',
    encode(digest('manual-expense:' || new.id::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'manual_expense_id', new.id,
      'synced_at', now(),
      'full_amount', new.amount
    ),
    new.category_id,
    new.id
  )
  on conflict (manual_expense_id)
  do update set
    billing_cycle_id = excluded.billing_cycle_id,
    credit_card_id = excluded.credit_card_id,
    bank_id = excluded.bank_id,
    transaction_date = excluded.transaction_date,
    description = excluded.description,
    movement_type = excluded.movement_type,
    amount = excluded.amount,
    original_amount = excluded.original_amount,
    installment_current = excluded.installment_current,
    installment_total = excluded.installment_total,
    installments_remaining = excluded.installments_remaining,
    category_id = excluded.category_id,
    raw_metadata = excluded.raw_metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists expenses_sync_manual_credit_to_billing
  on public.expenses;

create trigger expenses_sync_manual_credit_to_billing
after insert or update of
  amount,
  description,
  category_id,
  bank_id,
  payment_method_id,
  card_type,
  installments_count,
  expense_date
on public.expenses
for each row
execute function public.sync_manual_credit_expense_to_billing();
