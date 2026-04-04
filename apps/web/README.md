# Clova Pay Africa — Web App

This is the **end-user web app** for Clova Pay Africa.

## Routes

- `/` — marketing/landing
- `/app` — **offramp flow** (stablecoin → local fiat)

## MiniPay support (Opera / Celo)

The `/app` flow supports **1-tap deposits in MiniPay** for **cUSD on Celo** via the injected EIP-1193 provider.

## Local dev

```bash
cd apps/web
npm install

# required
export CLOVA_API_URL="http://localhost:3001"   # (or wherever apps/api is running)
export CLOVA_OWNER_API_KEY=""                   # optional: bypass x402 locally if set

npm run dev
```

Open:
- http://localhost:3000/app

## Env vars

- `CLOVA_API_URL` (required)
  - Base URL for the API (example: `https://clova-pay-africa-api.up.railway.app`)
- `CLOVA_OWNER_API_KEY` (optional)
  - If set, the web app will call the API with `x-api-key` to bypass x402 during demos/admin usage.

## Notes

- Corridors supported: `NGN, KES, GHS, UGX, TZS, MWK, BRL, XOF, INR` (ZAR not supported)
- Stacks `USDCx` deposits are currently **manual** in the UI (copy deposit details + paste tx hash).
