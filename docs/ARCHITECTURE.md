# Clova Pay Africa Architecture

## 1) What this system does
Clova Pay Africa is a crypto-to-fiat offramp infrastructure layer.

Current production target:
- Stablecoin rails: **cUSD (Celo), USDC (Base), USDCx (Stacks)**
- Fiat corridor: **NGN**
- Payout rail: **Paystack transfers**

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
- Quote generation
- Payout order creation and status retrieval
- Liquidity provider management
- Settlement acknowledgement endpoint
- Paystack webhook handling
- Access control/billing middleware (x402/API key)

### Ledger
- Current: in-memory fallback + Postgres mode (`DATABASE_URL`)
- Stores:
  - payouts
  - liquidity providers

### PSP Adapter Layer
- Current: Paystack
- Planned: Flutterwave for more African corridors

### Chain Watchers (next phase)
- Detect and confirm inbound deposit transactions on Celo/Base/Stacks
- Trigger settlement state transitions and payout release

---

## 4) High-level flow

1. Client requests quote (`POST /v1/quotes`)  
2. Client creates payout request (`POST /v1/payouts`)  
3. Onchain funds are confirmed (watcher or `settlements/credited` scaffold)  
4. Paystack transfer is created  
5. Paystack webhook updates payout status (`settled` / `failed`)  

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
- `/v1/webhooks/paystack`

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
- Verify Paystack webhook signatures before mutating payout state
- Keep payout state transitions idempotent
- Require onchain confirmation thresholds before payout release
- Log all settlement + payout events for audit/reconciliation

---

## 9) Future architecture extensions
- Flutterwave adapter for additional countries
- Full watcher services for Celo/Base/Stacks
- API consumers dashboard (usage + billing)
- Treasury/risk engine (inventory + exposure limits)
