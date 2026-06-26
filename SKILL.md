---
name: clova-pay-africa
description: >
  Crypto-to-fiat offramp API for Africa. Convert stablecoins (USDC, cUSD, USDCx) to local
  African fiat (NGN, KES, GHS, UGX, TZS, MWK, BRL) via bank transfer or mobile money.
  All paid endpoints are gated by the x402 payment protocol — agents pay micro-fees per
  API call using on-chain stablecoin signatures, no API key signup required.
---

# Clova Pay Africa — Agent Skill

> **One-liner:** Send stablecoins in, get African fiat out — agent-native, x402-gated offramp infrastructure.

Use this skill when an agent needs to:
- Convert crypto stablecoins to local African fiat (bank transfer or mobile money)
- Get real-time offramp exchange rate quotes for African corridors
- Look up supported banks and mobile money providers for a country
- Manage offramp orders (create, track status, dispute, refund)
- Perform fiat onramp (buy crypto with local fiat)

Do **NOT** use this skill for:
- Swapping between two cryptocurrencies (this is fiat offramp/onramp only)
- Fiat-to-fiat transfers (no corridor without a crypto leg)
- Chains/tokens not listed below

---

## 1. How x402 Payment Works (Critical for Agents)

All paid endpoints are protected by the **x402 payment protocol** (v2, via Thirdweb).
This means agents pay a micro-fee per API call by signing an on-chain payment proof —
no traditional API key registration is needed.

### What the agent must do

1. **Install the SDK**: `npm install thirdweb` (the `thirdweb/x402` module handles signing)
2. **Create a payment signature** for each request using the agent's own EVM wallet
3. **Attach the signature** as a `payment-signature` HTTP header on every paid request
4. **Read the receipt** from the `x-payment-receipt-id` response header for reconciliation

### Per-endpoint pricing (configurable by the server operator)

| Endpoint group | Default price | Env override |
|---|---|---|
| Quotes (`/v1/quotes`) | $0.001 | `X402_PRICE_QUOTE` |
| Orders & Payouts (`/v1/orders`, `/v1/payouts`) | $0.02 | `X402_PRICE_PAYOUT` |
| Liquidity (`/v1/liquidity/*`) | $0.005 | `X402_PRICE_LIQUIDITY` |
| Settlements & Ledger (`/v1/settlements/*`, `/v1/ledger/*`, `/v1/stats/*`) | $0.005 | `X402_PRICE_SETTLEMENT` |

### x402 network / chain for billing

The x402 billing chain is configured server-side (default: **Celo**).
Supported billing chains: `celo`, `base`, `celo-sepolia`.

> **Key concept:** The billing chain (where the agent pays the micro-fee) is independent
> of the settlement chain (where the user's stablecoins are deposited for offramp).
> An agent can pay x402 fees on Celo while settling a USDC offramp on Base.

### Fallback: Owner API Key bypass

For internal/admin use, the server operator can set an `OWNER_API_KEY`. Pass it as:
- `x-api-key: <key>` header, **or**
- `Authorization: Bearer <key>` header

This bypasses x402 entirely. Agents should prefer x402 for production use.

### TypeScript example — paying via x402

```typescript
import { createThirdwebClient, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";

const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
const account = privateKeyToAccount({ client, privateKey: AGENT_PRIVATE_KEY });

// The x402 SDK signs a payment proof automatically when you use the
// thirdweb fetch wrapper. Alternatively, construct the header manually:
//   import { createPaymentHeader } from "thirdweb/x402";
//   const paymentSig = await createPaymentHeader({ ... });

const res = await fetch("https://api.clovapay.africa/v1/quotes", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "payment-signature": paymentSig,  // x402 V2 payment proof
  },
  body: JSON.stringify({
    asset: "USDC_BASE",
    amountCrypto: "50",
    destinationCurrency: "NGN",
  }),
});
```

---

## 2. Supported Assets (Crypto Input)

| Asset Code | Chain | Token | Decimals | Notes |
|---|---|---|---|---|
| `cUSD_CELO` | Celo | cUSD | 18 | Paycrest deposit address per order |
| `USDC_BASE` | Base | USDC | 6 | Paycrest deposit address per order |
| `USDC_ARBITRUM` | Arbitrum One | USDC | 6 | Paycrest deposit address per order |
| `USDT_ARBITRUM` | Arbitrum One | USDT | 6 | Paycrest deposit address per order |
| `USDC_POLYGON` | Polygon | USDC | 6 | Paycrest deposit address per order |
| `USDT_POLYGON` | Polygon | USDT | 6 | Paycrest deposit address per order |
| `USDC_ETHEREUM` | Ethereum | USDC | 6 | Paycrest deposit address per order |
| `USDT_ETHEREUM` | Ethereum | USDT | 6 | Paycrest deposit address per order |
| `USDT_BSC` | BNB Smart Chain | USDT | 18 | Paycrest deposit address per order |
| `USDC_BSC` | BNB Smart Chain | USDC | 18 | Paycrest deposit address per order |
| `USDC_SCROLL` | Scroll | USDC | 6 | Paycrest deposit address per order |
| `USDT_SCROLL` | Scroll | USDT | 6 | Paycrest deposit address per order |
| `USDT_LISK` | Lisk | USDT | 6 | Paycrest deposit address per order |
| `USDC_LISK` | Lisk | USDC | 6 | Paycrest deposit address per order |
| `USDCX_STACKS` | Stacks | USDCx | 6 | Clarity contract; orderId in memo |

## 3. Supported Fiat Corridors (Output)

| Currency | Country | Mobile Money | Banks |
|---|---|---|---|
| NGN | 🇳🇬 Nigeria | OPay, PalmPay, Moniepoint | Access, GTBank, Zenith, UBA, First Bank + 25 more |
| KES | 🇰🇪 Kenya | M-PESA (`SAFAKEPC`), Airtel | Equity, KCB, ABSA, Cooperative + 30 more |
| GHS | 🇬🇭 Ghana | MTN MoMo, Vodafone Cash, AirtelTigo | GCB, Ecobank, Zenith, ABSA + 25 more |
| UGX | 🇺🇬 Uganda | MTN Mobile Money, Airtel Money | — |
| TZS | 🇹🇿 Tanzania | Tigo Pesa, Airtel Money, Halopesa | CRDB, NMB, Equity, KCB + 50 more |
| MWK | 🇲🇼 Malawi | TNM Mpamba | National Bank, Standard Bank, FDH + more |
| BRL | 🇧🇷 Brazil | Pix, PixQR | — |

> XOF (West Africa CFA) and INR (India) corridors are pending provider onboarding.

Use `GET /v1/banks?currency=<CURRENCY>` to dynamically fetch the full list of supported institutions for any corridor.

---

## 4. Core Offramp Flow (Step-by-Step)

### Step 1 — Create an offramp order

```
POST /v1/orders
```

**Request body:**
```json
{
  "asset": "USDC_BASE",
  "amountCrypto": "25",
  "destinationCurrency": "NGN",
  "recipient": {
    "accountName": "Jane Doe",
    "accountNumber": "0123456789",
    "bankCode": "058"
  },
  "returnAddress": "0x..."
}
```

- `asset` — one of the supported asset codes above
- `amountCrypto` — amount as string (e.g. `"25"`)
- `destinationCurrency` — target fiat currency code (default: `"NGN"`)
- `recipient.bankCode` — institution code (use `GET /v1/banks` to discover)
- `returnAddress` — optional refund address if order fails/expires

**Response:**
```json
{
  "orderId": "ord_58149cba...",
  "status": "awaiting_deposit",
  "depositAddress": "0x77e3...01F8",
  "asset": "USDC_BASE",
  "amountCrypto": "25",
  "rate": "1500",
  "feeBps": 150,
  "feeFiat": "562.50",
  "receiveFiat": "36937.50",
  "expiresAt": 1771358153836
}
```

### Step 2 — Send crypto to the deposit address

The user/agent sends exactly `amountCrypto` of the specified token to `depositAddress`.
This is a standard ERC-20 `transfer()` call.

For **Stacks (USDCX_STACKS):** send USDCx to the Clarity contract with `orderId` as memo.

### Step 3 — Confirm the deposit

```
POST /v1/settlements/credited
```

```json
{
  "orderId": "ord_58149cba...",
  "asset": "USDC_BASE",
  "amountCrypto": "25",
  "txHash": "0xabc123...",
  "confirmations": 1
}
```

After confirmation, Clova Pay automatically:
1. Verifies the deposit on-chain
2. Initiates a Paycrest fiat payout to the recipient's bank/wallet
3. Updates order status → `paid_out` → `settled` (via webhook)

### Step 4 — Poll order status (optional)

```
GET /v1/orders/:orderId
```

| Status | Meaning |
|---|---|
| `awaiting_deposit` | Order created, waiting for crypto |
| `confirming` | Deposit detected, processing payout |
| `paid_out` | Fiat payout initiated via Paycrest |
| `settled` | Fiat delivered to bank/wallet ✅ |
| `failed` | Something went wrong (check `failureReason`) |
| `expired` | 30-min deposit window elapsed |

---

## 5. All API Endpoints

### Public (no auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/v1/banks?currency=NGN` | List supported institutions for a currency |
| `POST` | `/v1/webhooks/paycrest` | Paycrest webhook callback (server-to-server) |
| `POST` | `/v1/watchers/deposits` | On-chain watcher callback (token-gated) |

### Paid (x402 or API key required)

| Method | Path | x402 Price | Description |
|---|---|---|---|
| `POST` | `/v1/quotes` | $0.001 | Get a standalone rate quote |
| `POST` | `/v1/orders` | $0.02 | **Create offramp order** (recommended entry point) |
| `GET` | `/v1/orders` | $0.02 | List all orders |
| `GET` | `/v1/orders/:orderId` | $0.02 | Get order status |
| `GET` | `/v1/orders/:orderId/debug` | $0.02 | Deep debug snapshot (includes Paycrest status) |
| `POST` | `/v1/orders/:orderId/dispute` | $0.02 | Open a dispute on an order |
| `POST` | `/v1/orders/:orderId/refund` | $0.02 | Request a refund |
| `POST` | `/v1/recipients/resolve` | $0.02 | Verify bank account details |
| `POST` | `/v1/settlements/credited` | $0.005 | Confirm a crypto deposit |
| `GET` | `/v1/settlements` | $0.005 | List settlements |
| `GET` | `/v1/ledger/entries` | $0.005 | List fee ledger entries |
| `POST` | `/v1/liquidity/providers` | $0.005 | Register as a liquidity provider |
| `GET` | `/v1/liquidity/providers` | $0.005 | List liquidity providers |
| `POST` | `/v1/liquidity/providers/:id/adjust` | $0.005 | Adjust LP balance |
| `POST` | `/v1/onramp/quote` | $0.02 | Get onramp (buy) rate |
| `POST` | `/v1/onramp/orders` | $0.02 | Create onramp order (fiat → crypto) |
| `GET` | `/v1/onramp/orders/:orderId` | $0.02 | Get onramp order status |
| `POST` | `/v1/payouts` | $0.02 | Create standalone payout (legacy) |
| `GET` | `/v1/payouts` | $0.02 | List payouts (legacy) |

---

## 6. Standalone Quote (without creating an order)

```
POST /v1/quotes
```

```json
{
  "asset": "cUSD_CELO",
  "amountCrypto": "100",
  "destinationCurrency": "KES"
}
```

**Response:**
```json
{
  "quoteId": "q_...",
  "asset": "cUSD_CELO",
  "amountCrypto": "100",
  "destinationCurrency": "KES",
  "rate": "129.50",
  "feeBps": 150,
  "feeFiat": "194.25",
  "receiveFiat": "12755.75",
  "expiresAt": 1771358153836,
  "_rateInfo": {
    "marketRate": "130.00",
    "offrampRate": "129.50",
    "marginPct": 3,
    "spreadProfit": "50.00"
  }
}
```

- `feeBps`: 150 = 1.5% platform fee (configurable)
- `_rateInfo.marginPct`: rate margin baked in (default 3%)
- Quote expires after 5 minutes

---

## 7. Onramp Flow (Fiat → Crypto)

### Get onramp rate

```
POST /v1/onramp/quote
```

```json
{
  "network": "base",
  "token": "USDC",
  "amount": "50000",
  "fiat": "NGN"
}
```

### Create onramp order

```
POST /v1/onramp/orders
```

```json
{
  "amount": "50000",
  "sourceCurrency": "NGN",
  "destinationAsset": "USDC_BASE",
  "refundAccount": {
    "accountName": "Jane Doe",
    "accountNumber": "0123456789",
    "bankCode": "058"
  },
  "recipientAddress": "0x..."
}
```

Response includes `providerAccount` with bank details for the fiat deposit.

---

## 8. Discovering Supported Banks

```
GET /v1/banks?currency=KES
```

Returns a list of institutions from Paycrest for the given currency. Use the `code` field
as the `bankCode` in order/payout requests.

---

## 9. Error Handling

All errors return JSON with an `error` field:

```json
{ "error": "payout_provider_error", "detail": "..." }
```

| HTTP Status | Meaning |
|---|---|
| `400` | Invalid request body (check `error.detail`) |
| `402` | Payment required — missing x402 signature or API key |
| `404` | Order/resource not found |
| `422` | No liquidity provider available for this corridor/amount |
| `502` | Upstream provider error (bad bank details, etc.) |
| `503` | x402 not configured on the server, or deposit wallet missing |

---

## 10. Operational Guidance for Agents

1. **Retry policy**: Use exponential backoff for `5xx` errors. Do not retry `4xx`.
2. **Idempotency**: Maintain local operation IDs. Query order status before re-submitting.
3. **Deposit window**: Orders expire after **30 minutes** if no deposit is received.
4. **Stacks handling**: For `USDCX_STACKS`, include the `orderId` as a memo in the Clarity contract call. The Paycrest payout is created later by the settlement engine after on-chain confirmation.
5. **Webhooks**: Do not call webhook endpoints from client side. They are for server-to-server callbacks from Paycrest.
6. **Rate freshness**: Quotes expire after 5 minutes. Always fetch a fresh quote before creating an order.

---

## 11. Repository Layout

```
apps/
  api/                    # Express API server (TypeScript)
    src/
      server.ts           # Entry point — route mounting, x402 middleware
      middleware/
        access.ts         # x402 + owner-key access control
      routes/
        order.ts          # POST/GET /v1/orders (primary offramp flow)
        quote.ts          # POST /v1/quotes
        settlement.ts     # POST /v1/settlements/credited
        banks.ts          # GET /v1/banks
        liquidity.ts      # Liquidity provider management
        payout.ts         # Legacy payout routes
        webhook.ts        # Paycrest webhook handler
        watcher.ts        # On-chain deposit watcher callback
        health.ts         # GET /health
        stats.ts          # GET /v1/stats
      lib/
        config.ts         # All env-driven configuration
        types.ts          # Asset, Currency, Quote types
        quote.ts          # Quote generation logic
        rateProvider.ts   # CoinGecko rate fetcher with margin
        ledger.ts         # In-memory + Postgres persistence
        settlementEngine.ts  # Deposit → payout orchestration
        chainVerifier.ts  # On-chain tx verification (Celo/Base/Stacks)
        stacksWatcher.ts  # Stacks deposit polling
        treasuryFunder.ts # Auto-fund Paycrest deposit addresses
        expiryWorker.ts   # Expire stale orders after 30min
      providers/
        paycrest.ts       # Paycrest PSP integration
  web/                    # Next.js web app — /app checkout flow
contracts/
  stacks/
    clova-deposit.clar    # Clarity smart contract for USDCx deposits
docs/
  ARCHITECTURE.md
  API_GUIDE.md
  AGENT_INTEGRATION.md
```

---

## 12. Quick Start (Local Development)

```bash
cd apps/api
cp .env.example .env     # configure PAYCREST_API_KEY, THIRDWEB_SECRET_KEY, etc.
npm install
npm run dev              # starts on http://localhost:8787
```

### Required environment variables

| Variable | Purpose |
|---|---|
| `PAYCREST_API_KEY` | Paycrest sender API key |
| `PAYCREST_MODE` | `live` or `mock` |
| `THIRDWEB_SECRET_KEY` | Thirdweb secret for x402 facilitation |
| `X402_SERVER_WALLET` | EVM address that receives x402 micro-payments |
| `X402_NETWORK` | Billing chain: `celo` (default), `base`, `celo-sepolia` |
| `OWNER_API_KEY` | Admin bypass key (optional) |
| `TREASURY_PRIVATE_KEY` | Signs USDC transfers to Paycrest deposit addresses |
| `DATABASE_URL` | Postgres connection string (optional; falls back to in-memory) |

---

## 13. Complete Agent Integration Example

```typescript
const API = "https://api.clovapay.africa";

// --- Helper: attach x402 payment or API key ---
function paidHeaders(paymentSig?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (paymentSig) {
    h["payment-signature"] = paymentSig;
  } else {
    h["x-api-key"] = process.env.CLOVA_API_KEY!;
  }
  return h;
}

// 1. Discover banks for Kenya
const banks = await fetch(`${API}/v1/banks?currency=KES`).then(r => r.json());
// → { currency: "KES", institutions: [{ name: "M-PESA", code: "SAFAKEPC" }, ...] }

// 2. Get a quote
const quote = await fetch(`${API}/v1/quotes`, {
  method: "POST",
  headers: paidHeaders(paymentSig),
  body: JSON.stringify({
    asset: "USDC_BASE",
    amountCrypto: "50",
    destinationCurrency: "KES",
  }),
}).then(r => r.json());
// → { rate: "129.50", receiveFiat: "6281.25", ... }

// 3. Create order
const order = await fetch(`${API}/v1/orders`, {
  method: "POST",
  headers: paidHeaders(paymentSig),
  body: JSON.stringify({
    asset: "USDC_BASE",
    amountCrypto: "50",
    destinationCurrency: "KES",
    recipient: {
      accountName: "Jane Doe",
      accountNumber: "254712345678",
      bankCode: "SAFAKEPC",
    },
  }),
}).then(r => r.json());
// → { orderId, depositAddress, receiveFiat, rate, expiresAt, ... }

// 4. Send USDC to order.depositAddress (standard ERC-20 transfer)
// ... agent signs and broadcasts the transaction ...

// 5. Confirm deposit
await fetch(`${API}/v1/settlements/credited`, {
  method: "POST",
  headers: paidHeaders(paymentSig),
  body: JSON.stringify({
    orderId: order.orderId,
    asset: "USDC_BASE",
    amountCrypto: "50",
    txHash: "0xabc...",
    confirmations: 1,
  }),
});

// 6. Poll until settled
let status = "confirming";
while (status !== "settled" && status !== "failed") {
  await new Promise(r => setTimeout(r, 5000));
  const o = await fetch(`${API}/v1/orders/${order.orderId}`, {
    headers: paidHeaders(paymentSig),
  }).then(r => r.json());
  status = o.status;
}
```
