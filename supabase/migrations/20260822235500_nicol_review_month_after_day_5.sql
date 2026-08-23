-- En el enlace público de Nicol, después del día 05 el mes principal de revisión
-- pasa al mes siguiente. Los ciclos históricos siguen disponibles sin cambios.
--
-- Conservamos la implementación anterior como base para no alterar la generación
-- de movimientos, cuotas proyectadas ni recurrentes del mes calendario actual.

alter function public.get_nicol_share_cycles(text)
  rename to get_nicol_share_cycles_calendar_base;

create or replace function public.get_nicol_share_cycles(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_cycles jsonb;
  v_today date := (now() at time zone 'America/Santiago')::date;
  v_review_key text;
begin
  v_payload := public.get_nicol_share_cycles_calendar_base(p_token);

  if coalesce((v_payload ->> 'ok')::boolean, false) = false then
    return v_payload;
  end if;

  v_review_key := to_char(
    case
      when extract(day from v_today)::integer > 5
        then (date_trunc('month', v_today)::date + interval '1 month')::date
      else date_trunc('month', v_today)::date
    end,
    'YYYY-MM'
  );

  select coalesce(
    jsonb_agg(
      cycle.value
      || jsonb_build_object(
        'isCurrent', (cycle.value ->> 'cycleKey') = v_review_key,
        'isUpcoming', (cycle.value ->> 'cycleKey') > v_review_key,
        'status', case
          when (cycle.value ->> 'cycleKey') > v_review_key then 'upcoming'
          when (cycle.value ->> 'cycleKey') = v_review_key
               and (cycle.value ->> 'status') = 'upcoming' then 'in_progress'
          else cycle.value ->> 'status'
        end
      )
      order by cycle.ordinality
    ),
    '[]'::jsonb
  )
  into v_cycles
  from jsonb_array_elements(coalesce(v_payload -> 'cycles', '[]'::jsonb))
       with ordinality as cycle(value, ordinality);

  v_payload := jsonb_set(v_payload, '{currentCycleKey}', to_jsonb(v_review_key), true);
  v_payload := jsonb_set(v_payload, '{cycles}', v_cycles, true);

  return v_payload;
end;
$$;

grant execute on function public.get_nicol_share_cycles(text) to anon, authenticated;
