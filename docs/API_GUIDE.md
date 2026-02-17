# Clova Pay Africa — Integrator Guide

> **The crypto-to-fiat offramp API.** Accept stablecoins from your users and deliver Nigerian Naira to their bank accounts — in 3 API calls.

Base URL: `https://api.clovapay.africa` (local: `http://localhost:8787`)

---

## Quick Start (3 Steps)

### Step 1 → Create an Offramp Order

One call bundles the quote + recipient details and returns a deposit address:

```bash
curl -X POST https://api.clovapay.africa/v1/orders \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "asset": "cUSD_CELO",
    "amountCrypto": "25",
    "recipient": {
      "accountName": "Jane Doe",
      "accountNumber": "2209866438",
      "bankCode": "057"
    }
  }'
```

**Response:**
```json
{
  "orderId": "ord_58149cba-...",
  "status": "awaiting_deposit",
  "depositAddress": "0x77e3...01F8",
  "asset": "cUSD_CELO",
  "amountCrypto": "25",
  "rate": "1500",
  "feeNgn": "562.50",
  "receiveNgn": "36937.50",
  "expiresAt": 1771358153836
}
```

### Step 2 → User Sends Crypto to the Deposit Address

Show your user the `depositAddress` and `amountCrypto`. They sign a normal ERC-20 transfer.

**JavaScript / ethers.js example:**
```js
import { ethers } from "ethers";

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

async function sendDeposit(order) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const cusd = new ethers.Contract(CUSD_ADDRESS, ERC20_ABI, signer);

  const tx = await cusd.transfer(
    order.depositAddress,
    ethers.parseUnits(order.amountCrypto, 18)
  );
  
  return tx.hash; // pass this to Step 3
}
```

### Step 3 → Confirm the Deposit

Once you have the `txHash` from the on-chain transfer, notify Clova Pay:

```bash
curl -X POST https://api.clovapay.africa/v1/settlements/credited \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "orderId": "ord_58149cba-...",
    "asset": "cUSD_CELO",
    "amountCrypto": "25",
    "txHash": "0xabc123...",
    "confirmations": 1
  }'
```

**What happens automatically:**
1. Clova Pay verifies the deposit
2. A Paystack recipient is created for the bank account
3. A Paystack transfer is initiated (NGN → recipient's bank)
4. Order status flips to `paid_out`

### Step 4 → Poll Order Status (optional)

```bash
curl https://api.clovapay.africa/v1/orders/ord_58149cba-... \
  -H 'x-api-key: YOUR_API_KEY'
```

| Status | Meaning |
|---|---|
| `awaiting_deposit` | Order created, waiting for crypto |
| `confirming` | Deposit detected, processing payout |
| `paid_out` | Paystack transfer initiated |
| `settled` | Fiat delivered to bank (via webhook) |
| `failed` | Something went wrong (see `failureReason`) |
| `expired` | 30-min window elapsed without deposit |

---

## Full Web App Integration Example

Here's a complete React component for an offramp button:

```jsx
import { ethers } from "ethers";

const API = "https://api.clovapay.africa";
const API_KEY = "YOUR_API_KEY";

async function offramp({ asset, amount, bankName, bankAccount, bankCode }) {
  // 1. Create order
  const order = await fetch(`${API}/v1/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      asset, amountCrypto: amount,
      recipient: { accountName: bankName, accountNumber: bankAccount, bankCode },
    }),
  }).then(r => r.json());

  // 2. User sends crypto (browser wallet)
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const token = new ethers.Contract(TOKEN_ADDRESSES[asset], ERC20_ABI, signer);
  const tx = await token.transfer(order.depositAddress, ethers.parseUnits(amount, 18));
  await tx.wait(); // wait for 1 confirmation

  // 3. Confirm deposit
  const result = await fetch(`${API}/v1/settlements/credited`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      orderId: order.orderId,
      asset, amountCrypto: amount,
      txHash: tx.hash, confirmations: 1,
    }),
  }).then(r => r.json());

  // Fiat payout is now processing!
  return { order, settlement: result };
}
```

---

## Authentication

### API Key (recommended for server-to-server)
```
x-api-key: YOUR_API_KEY
```

### x402 Payment Protocol
Include x402 payment proof headers. See [x402.org](https://x402.org) for details.

---

## All Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/v1/webhooks/paystack` | Paystack webhook callback |
| POST | `/v1/watchers/deposits` | On-chain watcher callback |

### Paid (require auth)
| Method | Path | Description |
|---|---|---|
| **POST** | **`/v1/orders`** | **Create offramp order** (recommended) |
| **GET** | **`/v1/orders/:orderId`** | **Get order status** |
| GET | `/v1/orders` | List all orders |
| POST | `/v1/quotes` | Get a standalone quote |
| POST | `/v1/payouts` | Create standalone payout (legacy) |
| GET | `/v1/payouts` | List payouts |
| POST | `/v1/settlements/credited` | Confirm crypto deposit |
| GET | `/v1/settlements` | List settlements |
| GET | `/v1/ledger/entries` | List fee entries |

---

## Supported Assets

| Asset Code | Chain | Token | Decimals |
|---|---|---|---|
| `cUSD_CELO` | Celo | cUSD | 18 |
| `USDC_BASE` | Base | USDC | 6 |
| `USDCX_STACKS` | Stacks | USDCx | 6 |

## Supported Banks

Nigerian banks via Paystack. Common codes:

| Bank | Code |
|---|---|
| Access Bank | 044 |
| First Bank | 011 |
| GTBank | 058 |
| UBA | 033 |
| Zenith Bank | 057 |

Full list: [Paystack Bank Codes](https://api.paystack.co/bank)

---

## Error Handling

All errors return JSON with an `error` field:

```json
{ "error": "payout_provider_error", "detail": "paystack_http_400:Cannot resolve account" }
```

Common errors:
- `402` — Authentication required (missing API key)
- `400` — Invalid request body
- `502` — Paystack provider error (bad bank details, insufficient balance)
- `503` — No deposit wallet configured for asset
