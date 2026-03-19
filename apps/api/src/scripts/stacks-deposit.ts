import {
  bufferCV,
  makeContractCall,
  principalCV,
  uintCV,
  broadcastTransaction,
} from "@stacks/transactions";
import { getStacksNetwork, requireEnv, explorerTxUrl } from "./stacks-utils.js";

function parseArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const privateKey = requireEnv("STACKS_PRIVATE_KEY");

  const contract = parseArg("contract");
  const amountStr = parseArg("amount");
  const memo = parseArg("memo");
  const token = parseArg("token");

  if (!contract || !amountStr || !memo || !token) {
    console.error("Usage: npm run stacks:deposit -- --contract=SP..\.clova-deposit --token=SP..\.usdcx --amount=1000000 --memo=ord_...");
    process.exit(1);
  }

  const [contractAddress, contractName] = contract.split(".");
  const [tokenAddress, tokenName] = token.split(".");

  const network = getStacksNetwork();

  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: "deposit",
    functionArgs: [
      principalCV(`${tokenAddress}.${tokenName}`),
      uintCV(BigInt(amountStr)),
      bufferCV(Buffer.from(memo, "utf8")),
    ],
    senderKey: privateKey,
    network,
  });

  const res = await broadcastTransaction({ transaction: tx, network });

  if (typeof res === "string") {
    console.log(`✅ Deposit broadcasted: ${res}`);
    console.log(`Explorer: ${explorerTxUrl(res)}`);
    return;
  }

  console.error("❌ Deposit failed:", JSON.stringify(res, null, 2));
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
