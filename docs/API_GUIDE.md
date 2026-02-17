# API Guide (Agents + Integrators)

Base URL (local): `http://localhost:8787`

## Authentication / Access

### Option A: x402 (recommended)
Send payment proof headers expected by x402 middleware:
- `payment-signature` or `x-payment`

### Option B: Owner key (admin/internal)
- `x-api-key: <OWNER_API_KEY>`
- or `Authorization: Bearer <OWNER_API_KEY>`

---

## Public endpoints

### `GET /health`
Health probe.

### `POST /v1/webhooks/paystack`
Provider callback endpoint (server-to-server).

---

## Paid endpoints

### `POST /v1/quotes`
Request body:
```json
{
  "asset": "cUSD_CELO",
  "amountCrypto": "25",
  "destinationCurrency": "NGN"
}
```

Supported assets:
- `cUSD_CELO`
- `USDC_BASE`
- `USDCX_STACKS`

Response:
```json
{
  "quoteId": "q_...",
  "asset": "cUSD_CELO",
  "amountCrypto": "25",
  "rate": "1500",
  "feeBps": 150,
  "feeNgn": "562.50",
  "receiveNgn": "36937.50",
  "expiresAt": 1739760000000
}
```

---

### `POST /v1/payouts`
Create payout request. You can pass either:
- existing `recipientCode`, or
- account details (`accountName`, `accountNumber`, `bankCode`)

Request body:
```json
{
  "quoteId": "q_...",
  "amountKobo": 250000,
  "reason": "clova-offramp",
  "recipient": {
    "accountName": "Jane Doe",
    "accountNumber": "0123456789",
    "bankCode": "058"
  }
}
```

Response (example):
```json
{
  "payoutId": "po_...",
  "quoteId": "q_...",
  "amountKobo": 250000,
  "currency": "NGN",
  "recipientCode": "RCP_...",
  "status": "processing",
  "provider": "paystack",
  "transferCode": "TRF_...",
  "transferRef": "clova_...",
  "createdAt": 1739760000000,
  "updatedAt": 1739760000000
}
```

---

### `GET /v1/payouts`
List payouts.

### `GET /v1/payouts/:payoutId`
Get payout by id.

---

### `POST /v1/liquidity/providers`
Create LP record.

Request:
```json
{
  "name": "LP Desk 1",
  "feeBps": 150,
  "initialBalanceKobo": 100000000
}
```

### `GET /v1/liquidity/providers`
List LPs.

### `POST /v1/liquidity/providers/:providerId/adjust`
Adjust LP NGN balance.

Request:
```json
{ "deltaKobo": -500000 }
```

---

### `POST /v1/settlements/credited`
Manual settlement credit endpoint (paid).

Idempotency behavior:
- Duplicate `txHash` submissions are deduplicated server-side.
- Response includes `idempotent: true` when event already exists.

Request:
```json
{
  "quoteId": "q_...",
  "asset": "USDCX_STACKS",
  "amountCrypto": "50",
  "txHash": "0x...",
  "confirmations": 3,
  "providerId": "lp_..."
}
```

### `POST /v1/watchers/deposits`
Watcher callback endpoint (token-gated via `x-watcher-token`).

Rules:
- Requires confirmation threshold per asset (`MIN_CONFIRMATIONS_*`).
- Uses same idempotent settlement logic (dedupe by `txHash`).
- On new settlement, fee ledger entries are created:
  - `platform_fee`
  - `lp_fee` (when `providerId` provided)

### `GET /v1/settlements`
List credited settlements.

### `GET /v1/ledger/entries`
List fee ledger entries.

---

## Error conventions
- `400`: bad request validation
- `401`: invalid webhook signature
- `404`: resource missing
- `503`: x402 not configured (unless owner key bypass used)

---

## Important integration note
Stacks (`USDCX_STACKS`) is supported for **settlement**.
x402 is used for **API billing** on supported rails.
These are intentionally decoupled.
