-- Add billing_start_day to credit_cards to support cards whose cycle
-- does not start on billingEndDay+1 (e.g. CMR: starts day 20, ends day 19)
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS billing_start_day integer;

COMMENT ON COLUMN credit_cards.billing_start_day IS
  'First day of the billing cycle (day of month). Defaults to billing_day+1 if null.';
