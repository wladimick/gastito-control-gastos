-- Tabla de bancos para selector en la app
-- Ejecutar en Supabase → SQL Editor

create table if not exists public.banks (
  id    text primary key,
  label text not null
);

-- No RLS: lectura pública (datos no sensibles, solo catálogo)
alter table public.banks enable row level security;

create policy "banks_select_all" on public.banks
  for select using (true);

-- Insertar bancos (upsert para re-ejecutar sin error)
insert into public.banks (id, label) values
  ('bchile',      'Banco Chile'),
  ('bestado',     'Banco Estado'),
  ('santander',   'Santander'),
  ('bci',         'BCI'),
  ('itau',        'Itaú'),
  ('falabella',   'Banco Falabella'),
  ('ripley',      'Banco Ripley'),
  ('scotiabank',  'Scotiabank'),
  ('security',    'Banco Security'),
  ('consorcio',   'Banco Consorcio'),
  ('bice',        'BICE'),
  ('coopeuch',    'Coopeuch'),
  ('mach',        'Mach'),
  ('tenpo',       'Tenpo'),
  ('mercadopago', 'MercadoPago'),
  ('chek',        'Chek'),
  ('fpay',        'FPay'),
  ('global66',    'Global66'),
  ('tapp',        'Tapp'),
  ('losheroes',   'Los Héroes'),
  ('khipu',       'Khipu'),
  ('efectivo',    'Efectivo')
on conflict (id) do update set label = excluded.label;
