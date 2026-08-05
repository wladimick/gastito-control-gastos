update public.billing_transactions
set review_status = 'review_required',
    updated_at = now()
where installment_total > 1
  and installment_current = 0;

alter table public.billing_transactions
  drop constraint if exists billing_transactions_zero_installment_requires_review;

alter table public.billing_transactions
  add constraint billing_transactions_zero_installment_requires_review
  check (
    installment_current is null
    or installment_current >= 1
    or (
      installment_current = 0
      and review_status = 'review_required'
    )
  );
