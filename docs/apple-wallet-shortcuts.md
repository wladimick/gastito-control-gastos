# Apple Wallet → Gastito

Gastito can receive contactless Apple Wallet transactions through an iOS Shortcuts **Transaction** automation.

## Endpoint

`POST https://ravxmljbhbwptqpowamu.supabase.co/functions/v1/wallet-ingest`

Required header:

- `x-gastito-token: <personal ingestion token>`

JSON body:

```json
{
  "amount": "<Transaction → Amount>",
  "merchant": "<Transaction → Merchant>",
  "name": "<Transaction → Name>",
  "card": "<Transaction → Card or Pass>",
  "currency": "CLP"
}
```

The token is never committed to the repository. Only its SHA-256 hash is stored in `wallet_ingest_tokens`.

## iPhone setup

1. Open **Shortcuts → Automation → + → Transaction**.
2. Select the CMR Falabella and Banco de Chile credit cards.
3. Select **Run Immediately**.
4. Create a blank automation.
5. Add **Get Contents of URL**.
6. Use the endpoint above, method **POST**, request body **JSON**.
7. Add header `x-gastito-token` with the user's personal token.
8. For the JSON fields, use the **Shortcut Input** transaction properties: Amount, Merchant, Name and Card/Pass.
9. Save the automation.

Apple documents the Transaction trigger as an automation that runs when a selected Wallet card is used contactlessly.

## Backend behavior

- Authenticates using the hashed personal ingestion token.
- Resolves CMR Falabella / Banco Chile using card name or last four digits.
- Deduplicates matching card + merchant + amount events within a 10-minute window.
- Uses `infer_expense_category_id` for automatic categorization.
- If the category is `Otros`, the expense is stored with status `revisar`.
- Creates a normal Gastito credit-card expense, so the existing manual-credit synchronization places it into billing.
- Stores the original event in `wallet_ingest_events` for audit/reconciliation.

## Important limitation: installments

The Wallet Transaction shortcut input exposes transaction/card/merchant/amount/name, but not the number of installments. Gastito therefore assumes **1 installment** for live Wallet captures. The official card statement remains authoritative and should correct the billing transaction during reconciliation if a purchase was actually made in installments.

## Security

If the phone is lost or the token is exposed, deactivate the relevant row in `wallet_ingest_tokens` and issue a new token. The Edge Function does not require a Supabase JWT because it implements its own high-entropy API-token authentication.
