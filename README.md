# Clova Pay Africa

Offramp infrastructure for African payouts:
- Accept crypto stablecoins
- Settle local fiat (starting with NGN)
- Route payouts through PSPs (Paystack first, Flutterwave next)
- Add liquidity providers that earn fees

## Phase 1 (MVP)
- Corridor: **NGN**
- Rails:
  - cUSD on Celo -> NGN
  - USDC on Base -> NGN
  - USDCx (Stacks) -> NGN
- PSP: **Paystack transfers**

## Core Flow
1. User requests quote
2. System returns rate, fee, and destination amount
3. User deposits crypto to assigned wallet/reference
4. System confirms onchain settlement
5. System triggers Paystack transfer to recipient bank
6. Webhook updates final payout status

## Current API (MVP+)
- `GET /health` (public)
- `POST /v1/quotes` (paid)
- `POST /v1/payouts` (paid; supports recipientCode OR bank details)
- `GET /v1/payouts` (paid)
- `GET /v1/payouts/:payoutId` (paid)
- `POST /v1/webhooks/paystack` (public callback)
- `POST /v1/liquidity/providers` (paid)
- `GET /v1/liquidity/providers` (paid)
- `POST /v1/liquidity/providers/:providerId/adjust` (paid)
- `POST /v1/settlements/credited` (paid)

## Access Control / Billing
- Primary: **x402** via Thirdweb (`thirdweb/x402`) for agent-friendly pay-per-call access.
- Optional owner bypass: `OWNER_API_KEY` in `x-api-key` (or Bearer token) for internal/admin calls.
- Public unauthenticated endpoints remain limited to health and Paystack webhooks.

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
