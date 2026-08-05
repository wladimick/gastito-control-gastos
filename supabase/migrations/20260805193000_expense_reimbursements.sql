create table if not exists public.expense_reimbursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  billing_transaction_id uuid references public.billing_transactions(id) on delete set null,
  company text not null default 'TIBOX',
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  submission_due_date date,
  expected_payment_date date,
  status text not null default 'pending'
    check (status in ('pending','submitted','approved','reimbursed','excluded','rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  reimbursed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_reimbursements_expense_unique
  on public.expense_reimbursements(user_id, expense_id)
  where expense_id is not null;

create unique index if not exists expense_reimbursements_billing_unique
  on public.expense_reimbursements(user_id, billing_transaction_id)
  where billing_transaction_id is not null;

create index if not exists expense_reimbursements_user_status_idx
  on public.expense_reimbursements(user_id, status, submission_due_date);

alter table public.expense_reimbursements enable row level security;

drop policy if exists "Users can read own reimbursements" on public.expense_reimbursements;
create policy "Users can read own reimbursements"
  on public.expense_reimbursements for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reimbursements" on public.expense_reimbursements;
create policy "Users can insert own reimbursements"
  on public.expense_reimbursements for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reimbursements" on public.expense_reimbursements;
create policy "Users can update own reimbursements"
  on public.expense_reimbursements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reimbursements" on public.expense_reimbursements;
create policy "Users can delete own reimbursements"
  on public.expense_reimbursements for delete
  using (auth.uid() = user_id);

drop trigger if exists expense_reimbursements_touch_updated_at on public.expense_reimbursements;
create trigger expense_reimbursements_touch_updated_at
  before update on public.expense_reimbursements
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.expense_reimbursements to authenticated;
