# Clova Pay — Governance & Sustainability

**Status:** Living document · **Last updated:** July 2026
**Scope:** How Clova Pay is governed today, how stewardship broadens over time, and how the project sustains itself as public infrastructure.

---

## 1. Mission and commitments

Clova Pay is open payment infrastructure for stablecoin-to-local-currency settlement across Africa (NGN, KES, GHS, UGX), designed to benefit the ecosystem rather than any single commercial entity.

Non-negotiable commitments, regardless of governance stage:

- **Open source.** All core code remains under an OSI-approved license ([LICENSE — e.g. MIT/Apache-2.0]). No open-core bait-and-switch: the settlement rails, API, and integrations stay open.
- **Open data and findings.** Aggregate transaction metrics, integration guides, and post-mortems are published.
- **Credible neutrality.** Protocol fees and routing logic favor no privileged party. Liquidity provision is permissionless.
- **Forkability as a right.** Anyone may fork and redeploy. Governance exists to make forking unnecessary, not impossible.

## 2. Governance today (Stage 0 — Founder-steward)

Clova Pay is currently maintained by its founder, Gabriel Temtsen ([@gabrieltemtsen](https://github.com/gabrieltemtsen)), who acts as steward with the following obligations:

- All development happens in the public repository (https://github.com/gabrieltemtsen/clova-pay-africa); no private feature branches for core functionality.
- Roadmap and material decisions (fee changes, new chains, breaking API changes) are proposed as public GitHub issues/discussions with a minimum 7-day comment window before merging.
- A public `CHANGELOG` and versioned API (semver; deprecations announced ≥90 days ahead) protect integrators from unilateral breakage.
- Admin access to deployment, domains, and treasury is documented in a private continuity file shared with [named backup steward / Artizen contact] to eliminate single-person key risk.

## 3. Stewardship roadmap

Progression is triggered by adoption milestones, not dates — governance should grow with real usage, not ahead of it.

### Stage 1 — Maintainer group (trigger: 3+ regular external contributors or 3+ independent production integrators)

- Form a maintainer group of 3–5 people: founder + contributors and/or integrator representatives with merge rights.
- Adopt lazy consensus for routine changes; simple majority of maintainers for material changes (fees, chain support, treasury spend).
- Publish `MAINTAINERS.md` with roles and a documented path from contributor → maintainer.

### Stage 2 — Multi-stakeholder council (trigger: sustained volume ≥ [threshold]/month or a named institutional deployment)

- Establish a council with seats for: maintainers, liquidity providers, integrators, and community/end-user representatives.
- Treasury moves to a multisig ([e.g. 3-of-5 Safe]) with council signers; all spends on-chain and public.
- Fee parameters and protocol upgrades require council approval with a public vote record.

### Stage 3 — Community-governed protocol (trigger: council consensus that the protocol is stable and adoption is broad)

- Evaluate transfer of stewardship to a neutral home: a foundation, an existing ecosystem body (e.g. Celo, Base, or Stacks ecosystem foundation), or on-chain governance — whichever best preserves neutrality and continuity.
- Founder retains no unilateral control; contributor rights and license commitments carry over as chartered constraints.

## 4. Sustainability plan

Clova Pay is designed to fund its own maintenance from protocol activity rather than perpetual grants:

1. **Liquidity-provider fee share.** LPs earn fees on settlement volume; a protocol margin ([X] bps) accrues to the project treasury. Sustainability scales with usage.
2. **x402 pay-per-call billing.** Agents and developers pay per API call. This revenue funds hosting, monitoring, and maintainer time, and grows with the agentic-payments lane.
3. **Grants and ecosystem funding** (Artizen, chain ecosystem funds) bridge the gap until fee revenue covers costs; grant income and spend are reported publicly.
4. **Cost floor transparency.** Monthly infrastructure cost (~$[amount]) and runway are published quarterly, so the community can see exactly what "sustainable" means.

Treasury priorities, in order: infrastructure uptime → security (audits, bug bounty) → maintainer compensation → ecosystem grants for integrators.

## 5. Contribution and accountability

- `CONTRIBUTING.md` defines how to propose changes; all contributions reviewed in public PRs.
- Code of Conduct ([Contributor Covenant]) applies to all project spaces.
- Security disclosures via [security contact]; issues acknowledged within 72 hours.
- Disputes between integrators/LPs and maintainers are handled in public issues; unresolved disputes escalate to the council (Stage 2+).

## 6. Continuity guarantee

If the founder becomes unable or unwilling to maintain the project: the backup steward gains admin access via the continuity file; the license permits any party to fork and continue; and hosted infrastructure hand-off instructions are documented in `RUNBOOK.md`. Clova Pay is built to outlast any single person — including its founder.
