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
- `GET /health`
- `POST /v1/quotes`
- `POST /v1/payouts` (supports recipientCode OR bank details)
- `GET /v1/payouts`
- `GET /v1/payouts/:payoutId`
- `POST /v1/webhooks/paystack`
- `POST /v1/liquidity/providers`
- `GET /v1/liquidity/providers`
- `POST /v1/liquidity/providers/:providerId/adjust`
- `POST /v1/settlements/credited`

## Repo Layout
- `apps/api` – API service + provider adapters + ledger logic
- `docs` – architecture, product notes, runbooks

## Quick Start
```bash
cd apps/api
cp .env.example .env
pnpm install
pnpm dev
```

API default: `http://localhost:8787`
