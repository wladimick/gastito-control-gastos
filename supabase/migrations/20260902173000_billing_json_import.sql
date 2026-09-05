-- ============================================================
-- GASTITO — Importación manual JSON de movimientos de tarjeta
-- Fecha: 2026-09-02 (ajuste 2026-09-04)
--
-- Flujo:
--   1) la UI normaliza y valida el JSON;
--   2) p_preview = true simula ciclos y detecta duplicados;
--   3) p_preview = false crea/actualiza ciclos parciales e inserta
--      solo movimientos nuevos.
--
-- Soporta además:
--   - is_pending: movimiento pendiente sin fecha confirmada;
--   - affects_cycle_total: permite reflejar exactamente el total mostrado
--     por el banco cuando un movimiento visible aún no entra al total.
--
-- La función es SECURITY DEFINER porque billing_transactions se
-- administra con RLS. La propiedad de la tarjeta se valida siempre
-- contra auth.uid(); no permite importar datos para otro usuario.
-- ============================================================

create or replace function public.gastito_normalize_billing_description(p_value text)
returns text
language sql
immutable
as $$
  select translate(
    lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g')),
    'áéíóúüñ',
    'aeiouun'
  );
$$;

create or replace function public.import_billing_json(
  p_credit_card_id uuid,
  p_payload jsonb,
  p_preview boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.credit_cards%rowtype;
  v_item jsonb;
  v_ordinal integer;
  v_source_row integer;
  v_date date;
  v_cycle_date date;
  v_description text;
  v_normalized_description text;
  v_amount integer;
  v_original_amount integer;
  v_installment_current integer;
  v_installment_total integer;
  v_movement_type text;
  v_is_pending boolean;
  v_affects_cycle_total boolean;
  v_period_end_anchor date;
  v_period_start_anchor date;
  v_due_anchor date;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_cycle_key text;
  v_cycle_id uuid;
  v_duplicate_id uuid;
  v_source text;
  v_stable_hash text;
  v_results jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_ready integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_imported integer := 0;
  v_imported_amount bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para importar movimientos.' using errcode = '28000';
  end if;

  if p_credit_card_id is null then
    raise exception 'Debes seleccionar una tarjeta.' using errcode = '22023';
  end if;

  select card.* into v_card
  from public.credit_cards card
  where card.id = p_credit_card_id
    and card.user_id = v_user_id
    and card.is_active = true
  limit 1;

  if not found then
    raise exception 'La tarjeta seleccionada no existe o no pertenece al usuario.' using errcode = '42501';
  end if;

  if v_card.billing_day is null or v_card.payment_due_day is null then
    raise exception 'La tarjeta necesita día de facturación y día de vencimiento antes de importar.' using errcode = '22023';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'transactions') <> 'array'
     or jsonb_array_length(p_payload->'transactions') = 0 then
    raise exception 'El payload debe incluir un arreglo transactions con al menos un movimiento.' using errcode = '22023';
  end if;

  v_source := coalesce(nullif(btrim(p_payload->>'source'), ''), 'Gastito · JSON manual');

  <<item_loop>>
  for v_item, v_ordinal in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(p_payload->'transactions') with ordinality as item(value, ordinality)
  loop
    v_total := v_total + 1;
    v_duplicate_id := null;
    v_cycle_id := null;
    v_source_row := v_ordinal;

    begin
      if jsonb_typeof(v_item) <> 'object' then
        raise exception 'El movimiento debe ser un objeto JSON.';
      end if;

      v_source_row := coalesce(nullif(v_item->>'source_row', '')::integer, v_ordinal);
      v_date := nullif(v_item->>'date', '')::date;
      v_description := regexp_replace(btrim(coalesce(v_item->>'description', '')), '\s+', ' ', 'g');
      v_normalized_description := public.gastito_normalize_billing_description(v_description);
      v_amount := nullif(v_item->>'amount', '')::numeric::integer;
      v_original_amount := nullif(v_item->>'original_amount', '')::numeric::integer;
      v_installment_current := coalesce(nullif(v_item->>'installment_current', '')::integer, 1);
      v_installment_total := coalesce(nullif(v_item->>'installment_total', '')::integer, 1);
      v_is_pending := coalesce(nullif(v_item->>'is_pending', '')::boolean, false);
      v_movement_type := lower(coalesce(nullif(v_item->>'movement_type', ''),
        case
          when v_installment_total > 1 then 'installment'
          else 'purchase'
        end
      ));

      if v_item ? 'affects_cycle_total' then
        v_affects_cycle_total := coalesce(nullif(v_item->>'affects_cycle_total', '')::boolean, false);
      elsif v_is_pending then
        v_affects_cycle_total := false;
      else
        v_affects_cycle_total := v_movement_type not in ('payment', 'credit');
      end if;

      if v_date is null and not v_is_pending then raise exception 'Falta la fecha.'; end if;
      if v_description = '' then raise exception 'Falta la descripción.'; end if;
      if v_amount is null or v_amount <= 0 then raise exception 'El monto debe ser mayor que cero.'; end if;
      if v_installment_total < 1 then raise exception 'El total de cuotas debe ser al menos 1.'; end if;
      if v_installment_current < 1 or v_installment_current > v_installment_total then
        raise exception 'La cuota actual debe estar entre 1 y el total de cuotas.';
      end if;
      if v_original_amount is not null and v_original_amount <= 0 then
        raise exception 'El monto original debe ser mayor que cero.';
      end if;
      if v_movement_type not in ('purchase', 'installment', 'commission', 'tax', 'interest', 'payment', 'credit', 'other') then
        raise exception 'Tipo de movimiento no reconocido: %', v_movement_type;
      end if;
    exception when others then
      v_errors := v_errors + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', coalesce(v_source_row, v_ordinal),
        'status', 'error',
        'message', sqlerrm
      ));
      continue item_loop;
    end;

    -- Los pendientes sin fecha confirmada se asignan al ciclo vigente usando
    -- la fecha de importación, pero conservan transaction_date = null.
    v_cycle_date := coalesce(v_date, current_date);

    if extract(day from v_cycle_date)::integer >= coalesce(v_card.billing_start_day, v_card.billing_day + 1) then
      v_period_end_anchor := (date_trunc('month', v_cycle_date)::date + interval '1 month')::date;
    else
      v_period_end_anchor := date_trunc('month', v_cycle_date)::date;
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

    -- Duplicado exacto funcional: misma tarjeta, fecha (incluido null), monto
    -- y descripción normalizada.
    select tx.id into v_duplicate_id
    from public.billing_transactions tx
    where tx.user_id = v_user_id
      and tx.credit_card_id = v_card.id
      and tx.transaction_date is not distinct from v_date
      and abs(tx.amount) = abs(v_amount)
      and public.gastito_normalize_billing_description(tx.description) = v_normalized_description
    order by tx.created_at
    limit 1;

    if v_duplicate_id is not null then
      v_duplicates := v_duplicates + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_source_row,
        'status', 'duplicate',
        'cycle_key', v_cycle_key,
        'duplicate_id', v_duplicate_id,
        'date', v_date,
        'description', v_description,
        'amount', v_amount,
        'is_pending', v_is_pending,
        'affects_cycle_total', v_affects_cycle_total,
        'installment_current', v_installment_current,
        'installment_total', v_installment_total
      ));
      continue item_loop;
    end if;

    if p_preview then
      v_ready := v_ready + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_source_row,
        'status', 'ready',
        'cycle_key', v_cycle_key,
        'date', v_date,
        'description', v_description,
        'amount', v_amount,
        'movement_type', v_movement_type,
        'is_pending', v_is_pending,
        'affects_cycle_total', v_affects_cycle_total,
        'installment_current', v_installment_current,
        'installment_total', v_installment_total
      ));
      continue item_loop;
    end if;

    insert into public.billing_cycles (
      user_id, credit_card_id, cycle_key, period_start, period_end,
      closing_date, due_date, status, reported_amount,
      reported_amount_is_final, estimated_amount, reconciliation_status,
      source_file, notes
    ) values (
      v_user_id, v_card.id, v_cycle_key, v_period_start, v_period_end,
      v_period_end, v_due_date,
      case when v_due_date < current_date then 'closed' else 'in_progress' end,
      0, false, 0, 'partial',
      v_source,
      'Ciclo actualizado desde una importación manual JSON. El monto informado oficial no se reemplaza.'
    )
    on conflict (user_id, credit_card_id, cycle_key)
    do update set
      period_start = case
        when billing_cycles.reported_amount_is_final or billing_cycles.reconciliation_status = 'reconciled'
          then billing_cycles.period_start
        else excluded.period_start
      end,
      period_end = case
        when billing_cycles.reported_amount_is_final or billing_cycles.reconciliation_status = 'reconciled'
          then billing_cycles.period_end
        else excluded.period_end
      end,
      closing_date = case
        when billing_cycles.reported_amount_is_final or billing_cycles.reconciliation_status = 'reconciled'
          then billing_cycles.closing_date
        else excluded.closing_date
      end,
      due_date = case
        when billing_cycles.reported_amount_is_final or billing_cycles.reconciliation_status = 'reconciled'
          then billing_cycles.due_date
        else excluded.due_date
      end,
      updated_at = now()
    returning id into v_cycle_id;

    v_stable_hash := encode(
      extensions.digest(
        convert_to(
          concat_ws(':',
            'manual-json',
            v_user_id::text,
            v_card.id::text,
            coalesce(v_date::text, 'pending'),
            v_amount::text,
            v_normalized_description,
            v_installment_current::text,
            v_installment_total::text,
            v_is_pending::text,
            v_affects_cycle_total::text
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    insert into public.billing_transactions (
      user_id, billing_cycle_id, credit_card_id, bank_id,
      transaction_date, description, movement_type, amount, original_amount,
      installment_current, installment_total, installments_remaining,
      currency, affects_cycle_total, is_pending, review_status,
      source_file, source_kind, source_row, stable_hash, raw_metadata
    ) values (
      v_user_id, v_cycle_id, v_card.id, v_card.bank_id,
      v_date, v_description, v_movement_type, v_amount, v_original_amount,
      v_installment_current, v_installment_total,
      greatest(v_installment_total - v_installment_current, 0),
      'CLP', v_affects_cycle_total, v_is_pending, 'verified',
      v_source, 'manual', v_source_row, v_stable_hash,
      jsonb_build_object(
        'import_method', 'manual_json',
        'source', v_source,
        'source_row', v_source_row,
        'payload_item', v_item,
        'imported_at', now()
      )
    );

    perform public.refresh_one_billing_cycle_estimate(v_cycle_id);

    v_imported := v_imported + 1;
    v_imported_amount := v_imported_amount + v_amount;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'row', v_source_row,
      'status', 'imported',
      'cycle_key', v_cycle_key,
      'date', v_date,
      'description', v_description,
      'amount', v_amount,
      'movement_type', v_movement_type,
      'is_pending', v_is_pending,
      'affects_cycle_total', v_affects_cycle_total,
      'installment_current', v_installment_current,
      'installment_total', v_installment_total
    ));
  end loop;

  return jsonb_build_object(
    'preview', p_preview,
    'card_id', v_card.id,
    'card_name', v_card.name,
    'bank_id', v_card.bank_id,
    'source', v_source,
    'summary', jsonb_build_object(
      'total', v_total,
      'ready', v_ready,
      'duplicates', v_duplicates,
      'errors', v_errors,
      'imported', v_imported,
      'imported_amount', v_imported_amount
    ),
    'items', v_results
  );
end;
$$;

revoke all on function public.import_billing_json(uuid, jsonb, boolean) from public;
grant execute on function public.import_billing_json(uuid, jsonb, boolean) to authenticated;

comment on function public.import_billing_json(uuid, jsonb, boolean) is
  'Valida, previsualiza e importa movimientos de tarjeta desde JSON para la tarjeta autenticada, evitando duplicados exactos y soportando movimientos pendientes/fuera del total.';
