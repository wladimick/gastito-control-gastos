alter table public.previsional_contributions
  add column if not exists movement_type text,
  add column if not exists credited_amount bigint,
  add column if not exists fund_code text,
  add column if not exists fund_units numeric(18,4),
  add column if not exists unit_value numeric(14,2),
  add column if not exists source_folio text;
