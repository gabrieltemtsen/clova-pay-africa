# Clova Pay Africa

Open-source crypto → local fiat offramp infrastructure for Africa.

- Accept crypto stablecoins on multiple chains
- Settle local fiat across **9 African + global corridors** via Paycrest
- Agent-native pay-per-call API via **x402**
- Liquidity providers earn fees on every settlement

## Supported Corridors

| Country | Currency | Mobile Money | Banks |
|---------|----------|-------------|-------|
| 🇳🇬 Nigeria | NGN | OPay, PalmPay, Moniepoint | Access, GTBank, Zenith, UBA, First Bank + 25 more |
| 🇰🇪 Kenya | KES | M-PESA (`SAFAKEPC`), Airtel | Equity, KCB, ABSA, Cooperative + 30 more |
| 🇬🇭 Ghana | GHS | MTN MoMo, Vodafone Cash, AirtelTigo | GCB, Ecobank, Zenith, ABSA + 25 more |
| 🇺🇬 Uganda | UGX | MTN Mobile Money, Airtel Money | — |
| 🇹🇿 Tanzania | TZS | Tigo Pesa, Airtel Money, Halopesa | CRDB, NMB, Equity, KCB + 50 more |
| 🇲🇼 Malawi | MWK | TNM Mpamba | National Bank, Standard Bank, FDH + more |
| 🇧🇷 Brazil | BRL | Pix, PixQR | — |

> **Note:** XOF (West Africa CFA) and INR (India) corridors are pending Paycrest provider onboarding.

## Supported Chains / Tokens

| Chain | Token | Notes |
|-------|-------|-------|
| Celo | cUSD | Paycrest deposit address per order |
| Base | USDC | Paycrest deposit address per order |
| Stacks | USDCx | Clarity contract; orderId in memo |

## App (End-user UI)

This repo includes a real web app that renders the offramp UX at:

- **`/app`** — stablecoin → fiat checkout flow (MiniPay supported for cUSD on Celo)

Code: `apps/web`

## Core Flow

1. **Quote** — `POST /v1/quotes` with asset, amount, and destination currency
2. **Order** — `POST /v1/orders` with recipient bank/mobile details — returns a deposit address
3. **Deposit** — User sends crypto to the deposit address
4. **Settlement** — Chain watcher confirms deposit; Paycrest routes payout to recipient
5. **Webhook** — `POST /v1/webhooks/paycrest` updates final status

## API Reference

### Public (no auth)
- `GET /health`
- `POST /v1/webhooks/paycrest`
- `POST /v1/watchers/deposits`

### Paid (x402 or `OWNER_API_KEY`)
- `POST /v1/quotes` — get a rate quote for any corridor
- `POST /v1/orders` — create offramp order, returns deposit address
- `GET /v1/orders/:orderId` — order status
- `GET /v1/banks?currency=KES` — list supported institutions for a currency
- `POST /v1/recipients/resolve` — verify bank account details
- `POST /v1/liquidity/providers` — register as a liquidity provider
- `GET /v1/liquidity/providers`
- `POST /v1/liquidity/providers/:id/adjust`
- `POST /v1/settlements/credited`
- `GET /v1/settlements`
- `GET /v1/ledger/entries`

### Legacy (admin only)
- `POST /v1/payouts` — direct payout, requires `OWNER_API_KEY`

## Access Control / Billing

- **x402** via Thirdweb (`thirdweb/x402`) — pay-per-call, agent-friendly
  - `PAYMENT-SIGNATURE` header on request, `PAYMENT-RESPONSE` receipt on response
- **Owner bypass** — `OWNER_API_KEY` in `x-api-key` or Bearer token for admin/internal use
- Public endpoints: health check and Paycrest webhooks only

## Agent Integration Example

```typescript
// Get a quote
const quote = await fetch("https://your-clova-instance/v1/quotes", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": YOUR_KEY },
  body: JSON.stringify({
    asset: "USDC_BASE",
    amountCrypto: "10",
    destinationCurrency: "KES"
  })
});

// Create order
const order = await fetch("https://your-clova-instance/v1/orders", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": YOUR_KEY },
  body: JSON.stringify({
    asset: "USDC_BASE",
    amountCrypto: "10",
    destinationCurrency: "KES",
    recipient: {
      accountName: "Jane Doe",
      accountNumber: "254712345678",
      bankCode: "SAFAKEPC"   // M-PESA
    }
  })
});
// → { orderId, depositAddress, receiveFiat, rate, ... }
// Send USDC to depositAddress to trigger settlement
```

## Repo Layout

```
apps/
  api/          # Express API — routes, providers, ledger
    src/
      routes/   # quote, order, payout, banks, settlement, webhook, health
      providers/ # paycrest.ts — live Paycrest integration
      lib/      # config, types, quote logic, rate provider, ledger
  web/          # Next.js web app — `/app` checkout flow (MiniPay supported)
docs/           # ARCHITECTURE.md, API_GUIDE.md, AGENT_INTEGRATION.md
```

## Quick Start

```bash
cd apps/api
cp .env.example .env   # set PAYCREST_API_KEY, PAYCREST_MODE=live, etc.
pnpm install
pnpm dev
```

API default: `http://localhost:8787`

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `PAYCREST_API_KEY` | Paycrest sender API key |
| `PAYCREST_MODE` | `live` or `mock` |
| `PAYCREST_WEBHOOK_URL` | Public URL for Paycrest status callbacks |
| `DEPOSIT_WALLET_CELO` | cUSD deposit wallet (Celo) |
| `DEPOSIT_WALLET_BASE` | USDC deposit wallet (Base) |
| `DEPOSIT_WALLET_STACKS` | USDCx Clarity contract principal |
| `TREASURY_PRIVATE_KEY` | Signs USDC transfers to Paycrest deposit addresses |
| `OWNER_API_KEY` | Admin bypass key |

## Used By

- **[Clenja Agent](https://github.com/gabrieltemtsen/clenja-agent)** — Telegram AI finance assistant that uses Clova Pay for offramp cashouts

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- API reference: `docs/API_GUIDE.md`
- Agent integration: `docs/AGENT_INTEGRATION.md`
