# Clova Points (EVM)

Non-transferable points ledger used to prove unique-wallet onchain activity.

## Setup

```bash
cd contracts/evm
npm i
```

## Env

- `DEPLOYER_PRIVATE_KEY` - deployer EOA
- `BASE_RPC_URL`
- `CELO_RPC_URL`
- `POINTS_ISSUER_ADDRESS` - backend signer address used to authorize point claims
- `POINTS_ACTIVATION_BONUS` - default `100`

## Deploy

```bash
npm run deploy:base
npm run deploy:celo
```

## Contract summary

- Users call `activate()` once (user pays gas)
- Users call `claim(...)` to mint points (user pays gas, backend signs authorization)
- Events:
  - `Activated(user)`
  - `PointsClaimed(user, amount, reason, ref, newTotal)`
