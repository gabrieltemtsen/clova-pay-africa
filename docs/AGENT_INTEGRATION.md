# Agent Integration Guide

This guide is for autonomous agents that call Clova Pay Africa APIs.

## 1) Recommended call pattern

1. `POST /v1/quotes`
2. Present quote to user
3. Collect destination account details
4. `POST /v1/payouts`
5. Poll `GET /v1/payouts/:payoutId` until terminal state (`settled` or `failed`)

## 2) Billing strategy for agents

Primary:
- Use x402 payment headers per request

Fallback:
- Use owner/admin key only for internal workflows

## 3) Idempotency guidance (client-side for now)
Until server idempotency keys are formalized, agents should:
- maintain local operation IDs
- avoid duplicate submission on transient retries
- reconcile by querying payout status before re-submitting

## 4) Stacks handling
For `USDCX_STACKS` payouts:
- Continue normal quote/payout flow
- Settlement tx and confirmations are chain-specific
- Do not assume billing chain == settlement chain

## 5) Operational safety
- Add retry with exponential backoff for 5xx
- Do not retry webhook endpoints from client side
- Surface transfer failure reasons to operators

## 6) Minimal example (pseudo)
```ts
const quote = await post('/v1/quotes', {
  asset: 'USDC_BASE',
  amountCrypto: '100',
  destinationCurrency: 'NGN'
}, paidHeaders)

const payout = await post('/v1/payouts', {
  quoteId: quote.quoteId,
  amountKobo: 1000000,
  recipient: {
    accountName: 'Jane Doe',
    accountNumber: '0123456789',
    bankCode: '058'
  }
}, paidHeaders)

while (true) {
  const p = await get(`/v1/payouts/${payout.payoutId}`, paidHeaders)
  if (p.status === 'settled' || p.status === 'failed') break
  await sleep(3000)
}
```
