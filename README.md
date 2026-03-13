# Clova Pay Africa

Offramp infrastructure for African payouts:
- Accept crypto stablecoins
- Settle local fiat (supporting **NGN, KES, GHS, UGX**)
- Route payouts through **Paycrest** (multi-corridor aggregator)
- Add liquidity providers that earn fees

## Phase 1 (Live)
- Corridors: **NGN** (Nigeria), **KES** (Kenya), **GHS** (Ghana), **UGX** (Uganda)
- Rails:
  - cUSD on Celo -> Local Fiat
  - USDC on Base -> Local Fiat
  - USDCx on Stacks -> Local Fiat
- PSP: **Paycrest** (Primary rail for all corridors)


## Core Flow
1. User requests quote for a supported corridor (e.g., KES, NGN)
2. System returns rate, fee, and destination amount via Paycrest
3. User deposits crypto to assigned wallet/reference
4. System confirms onchain settlement
5. System triggers **Paycrest** payout to recipient bank or mobile wallet
6. Webhook updates final payout status


## Current API (MVP+)
- `GET /health` (public)
- `POST /v1/quotes` (paid)
- `POST /v1/payouts` (paid; supports recipientCode OR bank details)
- `GET /v1/payouts` (paid)
- `GET /v1/payouts/:payoutId` (paid)
- `POST /v1/webhooks/paycrest` (public callback)
- `POST /v1/watchers/deposits` (watcher token callback)
- `POST /v1/liquidity/providers` (paid)
- `GET /v1/liquidity/providers` (paid)
- `POST /v1/liquidity/providers/:providerId/adjust` (paid)
- `POST /v1/settlements/credited` (paid)
- `GET /v1/settlements` (paid)
- `GET /v1/ledger/entries` (paid)

## Access Control / Billing
- Primary: **x402** via Thirdweb (`thirdweb/x402`) for agent-friendly pay-per-call access.
  - Supports V2 headers: `PAYMENT-SIGNATURE` (request) and `PAYMENT-RESPONSE` (receipt).
- Optional owner bypass: `OWNER_API_KEY` in `x-api-key` (or Bearer token) for internal/admin calls.
- Public unauthenticated endpoints remain limited to health and Paycrest webhooks.


## Repo Layout
- `apps/api` – API service + provider adapters + ledger logic
- `docs` – architecture, product notes, runbooks

## Documentation
- Architecture: `docs/ARCHITECTURE.md`
- API reference: `docs/API_GUIDE.md`
- Agent integration: `docs/AGENT_INTEGRATION.md`

## Quick Start
```bash
cd apps/api
cp .env.example .env
pnpm install
pnpm dev
```

API default: `http://localhost:8787`
