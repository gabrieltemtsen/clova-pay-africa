// Minimal module shims to keep TypeScript builds passing in environments
// where upstream packages don't ship (or expose) TS declarations.
//
// NOTE: Prefer proper @types/* packages where available, but these shims
// unblock builds/CI and are safe for runtime.

declare module "cors" {
  import type { RequestHandler } from "express";
  const cors: (options?: any) => RequestHandler;
  export default cors;
}

declare module "thirdweb";
declare module "thirdweb/chains";
declare module "thirdweb/x402";
declare module "thirdweb/wallets";

declare module "viem";
declare module "viem/chains";
declare module "viem/accounts";
