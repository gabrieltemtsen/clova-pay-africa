# Clova Pay Africa — Stacks Contract

This folder contains the **Stacks/Clarity** contract used for the USDCx (Stacks) offramp flow.

## Goal
Users pay **USDCx on Stacks** into a smart contract, attaching the `orderId` as a memo.

The backend watcher (`apps/api/src/lib/stacksWatcher.ts`) detects the deposit and triggers settlement.

## Contract
- `clova-deposit.clar`
  - `deposit(token, amount, memo)` — transfers USDCx from user → contract
  - `withdraw(token, amount, recipient)` — admin (deployer) can sweep collected USDCx
  - `get-total-deposits()` — read-only counter

## Networks
We recommend deploying in this order:

1) **Testnet** (safe iteration)
2) **Mainnet** (real credibility)

## Deploy (recommended workflow)
We ship Node scripts that build + broadcast the contract deploy transaction.

### Env Vars
Set these before running the scripts:

- `STACKS_PRIVATE_KEY` — deployer private key
- `STACKS_NETWORK` — `testnet` or `mainnet`
- `STACKS_CONTRACT_NAME` — e.g. `clova-deposit`

Optional:
- `STACKS_API_URL` — override API endpoint (defaults to Hiro)

### Deploy
From `apps/api`:

```bash
npm run stacks:deploy
```

This prints:
- contract principal (what you set as `DEPOSIT_WALLET_STACKS`)
- deployment tx id + Hiro explorer link

## Make a deposit (demo)
1) Create an offramp order:
   - `POST /v1/orders` with `asset=USDCX_STACKS`
   - You’ll receive `depositMemo` = `ord_...`

2) Call the contract `deposit` function with:
- amount in **micro-units** (USDCx has 6 decimals)
- memo = buffer containing `ord_...`

From `apps/api`:

```bash
npm run stacks:deposit -- --amount=1000000 --memo=ord_... --contract=SP... .clova-deposit
```

The script prints the tx id + explorer link.

## Backend wiring
After deploy, set in your API env:

- `DEPOSIT_WALLET_STACKS=<contract principal>`
- `USDCX_STACKS_CONTRACT=<usdcx contract principal>` (if different from default)

Then the watcher will pick deposits up automatically.
