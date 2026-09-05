-- Endurecimiento posterior a auditoría Supabase del importador JSON.

create or replace function public.gastito_normalize_billing_description(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
    lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g')),
    'áéíóúüñ',
    'aeiouun'
  );
$$;

revoke execute on function public.import_billing_json(uuid, jsonb, boolean) from anon;
revoke execute on function public.import_billing_json(uuid, jsonb, boolean) from public;
grant execute on function public.import_billing_json(uuid, jsonb, boolean) to authenticated;
