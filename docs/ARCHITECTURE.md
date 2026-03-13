# Clova Pay Africa Architecture

## 1) What this system does
Clova Pay Africa is a crypto-to-fiat offramp infrastructure layer.

Current production target:
- Stablecoin rails: **cUSD (Celo), USDC (Base), USDCx (Stacks)**
- Fiat corridors: **NGN, KES, GHS, UGX**
- Payout rail: **Paycrest** (Multi-corridor PSP aggregator)
- *Legacy: Paystack (NGN only) is suspended.*


---

## 2) Core principle: Billing rail != Settlement rail
This is the key model for users and agents:

- **Billing rail**: how callers pay for API usage
  - Currently via **x402 (Thirdweb)** on supported chains (e.g., Celo/Base)
  - Optional admin bypass via `OWNER_API_KEY`
- **Settlement rail**: where user funds for payout come from
  - cUSD on Celo
  - USDC on Base
  - USDCx on Stacks

So even if x402 doesn’t support Stacks directly, **Stacks settlement is still supported**.

---

## 3) Service components

### API Service (`apps/api`)
Responsibilities:
- Quote generation (multi-currency)
- Payout order creation and status retrieval (Paycrest)
- Liquidity provider management
- Settlement acknowledgement endpoint
- Paycrest webhook handling
- Access control/billing middleware (x402 V2 / API key)

### Ledger
- Current: in-memory fallback + Postgres mode (`DATABASE_URL`)
- Stores:
  - payouts
  - liquidity providers

### PSP Adapter Layer
- Primary: **Paycrest** (supports NGN, KES, GHS, UGX)
- Suspended: Paystack (kept as stub for historical payouts)
- Future: Direct connections for high-volume corridors

### Chain Watchers
- Detect and confirm inbound deposit transactions on Celo/Base/Stacks
- Push confirmed deposits to `POST /v1/watchers/deposits` (token-gated)
- Trigger idempotent settlement credit flow (dedupe by `txHash`)
- Create fee ledger entries on first-seen settlement event

---

## 4) High-level flow

1. Client requests quote (`POST /v1/quotes`)  
2. Client creates payout request (`POST /v1/orders`)  
3. Onchain funds are confirmed (watcher or `settlements/credited` scaffold)  
4. Paycrest payout is created via the aggregator API  
5. Paycrest webhook updates payout status (`settled` / `failed`)  

---

## 5) State model (payout)
- `processing` -> payout initiated / waiting confirmation
- `settled` -> transfer success
- `failed` -> transfer failed or reversed

Planned expansion:
- `awaiting_deposit`
- `deposit_confirmed`
- `payout_queued`
- `payout_processing`
- `payout_settled`
- `payout_failed`

---

## 6) Access control and monetization

Protected endpoints use paid middleware:
- x402 settles payment proof per request
- Route-level pricing via env (`X402_PRICE_*`)

Public endpoints:
- `/health`
- `/v1/webhooks/paycrest`

Internal/admin path:
- `OWNER_API_KEY` via `x-api-key` or Bearer token

---

## 7) Liquidity provider model (current + planned)
Current:
- register LP
- adjust LP balance manually

Planned:
- automatic LP assignment per payout
- fee split accounting:
  - platform fee
  - LP earnings
- risk controls:
  - LP utilization limits
  - per-corridor velocity caps

---

## 8) Security and reliability notes
- Verify Paycrest webhook signatures before mutating payout state
- Keep payout state transitions idempotent
- Require onchain confirmation thresholds before payout release
- Log all settlement + payout events for audit/reconciliation

---

## 9) Future architecture extensions
- Flutterwave adapter for additional countries
- Full watcher services for Celo/Base/Stacks
- API consumers dashboard (usage + billing)
- Treasury/risk engine (inventory + exposure limits)
