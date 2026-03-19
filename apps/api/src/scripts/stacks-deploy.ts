import fs from "node:fs";
import path from "node:path";
import {
  broadcastTransaction,
  makeContractDeploy,
} from "@stacks/transactions";
import { getStacksNetwork, requireEnv, explorerTxUrl } from "./stacks-utils.js";

async function main() {
  const privateKey = requireEnv("STACKS_PRIVATE_KEY");
  const contractName = process.env.STACKS_CONTRACT_NAME || "clova-deposit";

  const contractPath = path.resolve("../../contracts/stacks/clova-deposit.clar");
  const codeBody = fs.readFileSync(contractPath, "utf8");

  const network = getStacksNetwork();

  const tx = await makeContractDeploy({
    contractName,
    codeBody,
    senderKey: privateKey,
    network,
  });

  const res = await broadcastTransaction({ transaction: tx, network });

  // broadcastTransaction may return string txid or { error }
  if (typeof res === "string") {
    console.log(`✅ Deploy broadcasted: ${res}`);
    console.log(`Explorer: ${explorerTxUrl(res)}`);
    console.log(`Contract name: ${contractName}`);
    console.log(`Next: set DEPOSIT_WALLET_STACKS=<DEPLOYER_ADDRESS>.${contractName} after confirmed.`);
    return;
  }

  console.error("❌ Deploy failed:", JSON.stringify(res, null, 2));
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
