create table if not exists public.mercadopago_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_normalized text not null,
  merchant_label text,
  category_id uuid not null references public.categories(id),
  active boolean not null default true,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_normalized)
);

alter table public.mercadopago_category_rules enable row level security;

drop policy if exists "Users can read own MP category rules" on public.mercadopago_category_rules;
create policy "Users can read own MP category rules"
  on public.mercadopago_category_rules for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own MP category rules" on public.mercadopago_category_rules;
create policy "Users can insert own MP category rules"
  on public.mercadopago_category_rules for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own MP category rules" on public.mercadopago_category_rules;
create policy "Users can update own MP category rules"
  on public.mercadopago_category_rules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own MP category rules" on public.mercadopago_category_rules;
create policy "Users can delete own MP category rules"
  on public.mercadopago_category_rules for delete
  using (auth.uid() = user_id);
