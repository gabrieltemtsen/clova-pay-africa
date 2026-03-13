# Clova Pay Africa — Dashboard & Checkout

The frontend for Clova Pay Africa, providing a user-friendly interface for offramping crypto to African fiat.

## Features
- **Checkout UI**: Simple flow to convert cUSD, USDC, and USDCx to local fiat.
- **Support for Multi-Fiat**: NGN (Nigeria), KES (Kenya), GHS (Ghana), UGX (Uganda).
- **Embedded Wallets**: Integrated with Thirdweb for seamless social/email login.

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration
Ensure your `.env.local` contains:
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- `NEXT_PUBLIC_API_URL` (pointing to the Clova API)

## Learn More
Check the root [README](../../README.md) and [Docs](../../docs) for more architecture and API details.

