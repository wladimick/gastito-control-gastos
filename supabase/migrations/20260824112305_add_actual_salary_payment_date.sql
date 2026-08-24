alter table public.salary_slips
  add column if not exists actual_payment_date date,
  add column if not exists payment_evidence text;

comment on column public.salary_slips.actual_payment_date is
  'Fecha bancaria efectiva en que se recibió el líquido. Si existe, prevalece sobre scheduled_payment_date para flujo de caja.';

comment on column public.salary_slips.payment_evidence is
  'Descripción breve de la evidencia usada para confirmar el abono.';
