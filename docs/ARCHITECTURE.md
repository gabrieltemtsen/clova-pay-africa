# Architecture (MVP)

## Services
- **API** (Express): quote, payout creation, status, webhooks
- **Onchain watcher** (next): confirms inbound stablecoin deposits
- **Ledger** (DB, next): immutable movement records

## Adapters
- PSP adapter interface:
  - `createTransfer`
  - `getTransfer`
  - `verifyWebhook`
- Implementations:
  - Paystack (MVP)
  - Flutterwave (Phase 2)

## Liquidity Provider Model (planned)
- LPs provision NGN float
- Payouts consume LP float
- Fee split:
  - platform fee
  - LP yield
- Risk controls:
  - per-LP caps
  - corridor caps
  - velocity limits
