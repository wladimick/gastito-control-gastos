-- Página pública de gastos compartidos con Nicol.
-- El detalle permanece privado por defecto y solo se expone cuando
-- el propietario marca explícitamente un movimiento.

alter table public.billing_transactions
  add column if not exists shared_with_nicol boolean not null default false;

comment on column public.billing_transactions.shared_with_nicol is
  'Permite mostrar el movimiento en el enlace público de Nicol. Falso por defecto.';

create index if not exists idx_billing_transactions_nicol_shared
  on public.billing_transactions (user_id, billing_cycle_id, transaction_date desc)
  where shared_with_nicol = true and affects_cycle_total = true and amount > 0;

create table if not exists public.billing_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Nicol',
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  percentage numeric(5,2) not null default 33 check (percentage >= 0 and percentage <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_share_links is
  'Enlaces públicos revocables. Solo se almacena SHA-256 del token, nunca el token original.';

create index if not exists idx_billing_share_links_user
  on public.billing_share_links (user_id, active, label);

create unique index if not exists uq_billing_share_links_active_label
  on public.billing_share_links (user_id, label)
  where active = true;

alter table public.billing_share_links enable row level security;

revoke all on table public.billing_share_links from anon;
grant select, insert, update, delete on table public.billing_share_links to authenticated;

-- Las políticas se recrean para mantener la migración idempotente.
drop policy if exists billing_share_links_select_own on public.billing_share_links;
drop policy if exists billing_share_links_insert_own on public.billing_share_links;
drop policy if exists billing_share_links_update_own on public.billing_share_links;
drop policy if exists billing_share_links_delete_own on public.billing_share_links;

create policy billing_share_links_select_own
  on public.billing_share_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy billing_share_links_insert_own
  on public.billing_share_links
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy billing_share_links_update_own
  on public.billing_share_links
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy billing_share_links_delete_own
  on public.billing_share_links
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_or_rotate_nicol_share(
  p_percentage numeric default 33
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_link_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_percentage is null or p_percentage < 0 or p_percentage > 100 then
    raise exception 'Percentage must be between 0 and 100';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  update public.billing_share_links
     set active = false,
         updated_at = now()
   where user_id = v_user_id
     and label = 'Nicol'
     and active = true;

  insert into public.billing_share_links (
    user_id,
    label,
    token_hash,
    percentage,
    active
  ) values (
    v_user_id,
    'Nicol',
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_percentage,
    true
  )
  returning id into v_link_id;

  return jsonb_build_object(
    'id', v_link_id,
    'token', v_token,
    'percentage', p_percentage
  );
end;
$$;

revoke execute on function public.create_or_rotate_nicol_share(numeric) from public, anon, authenticated;
grant execute on function public.create_or_rotate_nicol_share(numeric) to authenticated;

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
    return jsonb_build_object(
      'ok', false,
      'message', 'El enlace no existe o fue desactivado.'
    );
  end if;

  select link.*
    into v_link
    from public.billing_share_links as link
   where link.active = true
     and link.label = 'Nicol'
     and link.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   limit 1;

  if v_link.id is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'El enlace no existe o fue desactivado.'
    );
  end if;

  with eligible as (
    select
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
          'date', item.transaction_date,
          'description', item.description,
          'movementType', item.movement_type,
          'amount', item.amount
        )
        order by item.transaction_date desc nulls last, item.created_at desc
      ) as transactions
    from public.billing_cycles as cycle
    join eligible as item
      on item.billing_cycle_id = cycle.id
    where cycle.user_id = v_link.user_id
    group by
      cycle.id,
      cycle.cycle_key,
      cycle.period_start,
      cycle.period_end,
      cycle.due_date,
      cycle.status
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

-- Esta función pública es intencional: valida un token aleatorio de 192 bits,
-- entrega solo movimientos marcados y no expone IDs de usuario, tarjeta o archivos fuente.
revoke execute on function public.get_nicol_share(text) from public, anon, authenticated;
grant execute on function public.get_nicol_share(text) to anon, authenticated;
