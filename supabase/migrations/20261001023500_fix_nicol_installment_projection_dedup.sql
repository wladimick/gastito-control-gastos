-- Corrige las proyecciones de cuotas en la vista pública de Nicol.
-- 1) Una compra en cuotas se considera compartida en todo su plan si alguna cuota
--    del mismo plan fue marcada como compartida.
-- 2) Las proyecciones se agrupan por plan (tarjeta + monto original + número de cuotas)
--    y ya no por descripción/monto de la cuota, evitando duplicados cuando el banco
--    cambia el texto o ajusta unos pesos en la última cuota.
-- 3) Una cuota real reemplaza siempre a su proyección aunque difiera el texto o el monto.
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.get_nicol_share_cycles_calendar_base(text)'::regprocedure)
    into v_def;

  v_old := $old$
      and tx.shared_with_nicol = true
$old$;

  v_new := $new$
      and (
        tx.shared_with_nicol = true
        or (
          tx.movement_type = 'installment'
          and tx.original_amount is not null
          and exists (
            select 1
              from public.billing_transactions as shared_tx
             where shared_tx.user_id = tx.user_id
               and shared_tx.credit_card_id = tx.credit_card_id
               and shared_tx.movement_type = 'installment'
               and shared_tx.original_amount = tx.original_amount
               and shared_tx.installment_total = tx.installment_total
               and shared_tx.shared_with_nicol = true
          )
        )
      )
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró el filtro shared_with_nicol esperado';
  end if;
  -- Reemplaza las dos apariciones: actual_items y projected_seed.
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
      row_number() over (
        partition by
          to_char(to_date(cycle.cycle_key || '-01', 'YYYY-MM-DD') + make_interval(months => step.n), 'YYYY-MM'),
          upper(trim(tx.description)),
          tx.amount,
          tx.installment_current + step.n,
          tx.installment_total
        order by cycle.cycle_key desc, tx.installment_current desc, tx.created_at desc
      ) as projection_rank
$old$;

  v_new := $new$
      row_number() over (
        partition by
          to_char(to_date(cycle.cycle_key || '-01', 'YYYY-MM-DD') + make_interval(months => step.n), 'YYYY-MM'),
          tx.credit_card_id,
          case
            when tx.original_amount is not null
              then 'original:' || tx.original_amount::text || ':' || tx.installment_total::text
            else 'fallback:'
              || regexp_replace(
                   regexp_replace(upper(trim(tx.description)), '^(COMPRA EN CUOTAS|COMPRA)\\s+', '', 'g'),
                   '\\s+', ' ', 'g'
                 )
              || ':' || tx.amount::text || ':' || tx.installment_total::text
          end,
          tx.installment_current + step.n
        order by cycle.cycle_key desc, tx.installment_current desc, tx.created_at desc
      ) as projection_rank
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró el ranking de proyecciones esperado';
  end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
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
$old$;

  v_new := $new$
      and not exists (
        select 1
        from actual_items as actual
        where actual.cycle_key = seed.cycle_key
          and actual.movement_type = 'installment'
          and actual.installment_current = seed.installment_current
          and actual.installment_total = seed.installment_total
          and (
            (
              actual.original_amount is not null
              and seed.original_amount is not null
              and actual.original_amount = seed.original_amount
            )
            or (
              actual.original_amount is null
              and seed.original_amount is null
              and regexp_replace(
                    regexp_replace(upper(trim(actual.description)), '^(COMPRA EN CUOTAS|COMPRA)\\s+', '', 'g'),
                    '\\s+', ' ', 'g'
                  ) = regexp_replace(
                    regexp_replace(upper(trim(seed.description)), '^(COMPRA EN CUOTAS|COMPRA)\\s+', '', 'g'),
                    '\\s+', ' ', 'g'
                  )
              and actual.amount = seed.amount
            )
          )
      )
$new$;

  if position(v_old in v_def) = 0 then
    raise exception 'No se encontró el filtro de reemplazo de proyección esperado';
  end if;
  v_def := replace(v_def, v_old, v_new);

  execute v_def;
end;
$$;
