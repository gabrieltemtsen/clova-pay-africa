# Clova Pay — Adoption Evidence Report

**Reporting period:** [Month] – [Month] 2026 · **Published:** [date] · **Cadence:** monthly

The fund weights what it can verify over self-reporting. Every metric below is tagged with how a third party can check it.

**Live dashboard:** headline metrics — orders, settlements, payouts, fiat volume by currency, x402 agent calls, and distinct agent payers — are published in real time at `https://clova-pay-africa.vercel.app/stats` (public, auto-refreshing, backed by the open `/v1/stats` API). Settlements link directly to block explorers.

---

## 1. Headline metrics

| Metric | This period | Last period | Δ | Verification |
|---|---|---|---|---|
| Settlement volume (USD equiv.) | $[ ] | $[ ] | [ ]% | On-chain (Celo/Base/Stacks explorers, treasury + settlement addresses below) |
| Transactions settled | [ ] | [ ] | [ ]% | On-chain |
| Distinct paying API consumers | [ ] | [ ] | [ ]% | x402 on-chain payment records |
| Corridors active (of NGN/KES/GHS/UGX) | [ ]/4 | [ ]/4 | — | Payout records via Paycrest |
| Independent integrators in production | [ ] | [ ] | [ ]% | Named below, §3 |
| Liquidity providers earning fees | [ ] | [ ] | [ ]% | On-chain fee distributions |

**Verifiable addresses/endpoints:**

- Settlement contracts: Celo `[0x…]` · Base `[0x…]` · Stacks `[SP…]`
- Public status/metrics endpoint: `[https://…/stats]` (aggregate, no PII)
- Repository: `https://github.com/gabrieltemtsen/clova-pay-africa` — stars, forks, dependents visible via GitHub

## 2. What we instrument (and how)

- **On-chain first.** Volume, transaction count, LP fee payouts, and x402 payments are all on public chains — no trust in our dashboards required.
- **API analytics.** Distinct API keys with ≥1 successful payout per month = "active integrator." We publish counts, not identities, unless the integrator consents to be named.
- **Public /stats endpoint.** Aggregate rolling 30-day volume and transaction counts, queryable by anyone (including Artizen), updated daily.
- **GitHub signals.** Dependents graph, forks, external PRs/issues — adoption of the code, not just the service.

## 3. Integrator case studies

> Target: one new named case study per reporting period. Template below; consent obtained before naming.

### Case study: [Integrator name]

- **Who:** [remittance app / freelancer platform / agent framework / NGO disbursement program]
- **Corridor(s):** [e.g. USDC/Base → KES mobile money]
- **Integration:** [API payout flow / x402 pay-per-call / self-hosted fork]
- **In production since:** [date]
- **Scale:** [tx/month, volume, end users reached]
- **Verifiable via:** [on-chain address, public app, contact willing to confirm]
- **Quote:** "[1–2 sentences from the integrator]"

## 4. x402 / agentic usage (Lane 2 evidence)

| Metric | This period | Verification |
|---|---|---|
| Pay-per-call requests settled via x402 | [ ] | On-chain x402 receipts |
| Distinct agent/developer payers | [ ] | On-chain payer addresses |
| Agent frameworks integrated | [names] | Public repos/docs |

## 5. Trajectory narrative (≤150 words per report)

[What changed this period: new corridor, new integrator, notable volume driver, incident + resolution. Honest about dips — credibility compounds.]

## 6. Verification pack for Artizen

Sent with each report: links to explorer queries for the period's volume, the /stats endpoint, the GitHub dependents page, and contact details for any named integrator who has agreed to confirm usage.

---

### Instrumentation checklist (one-time setup)

- [ ] Publish settlement/treasury addresses in README
- [ ] Ship public `/stats` aggregate endpoint
- [ ] Tag API keys to distinguish integrators (no PII in public data)
- [ ] Enable GitHub dependents/insights visibility
- [ ] Dune (or similar) public dashboard querying settlement contracts
- [ ] Consent template for naming integrators in case studies
