import hre from "hardhat";

async function main() {
  const { ethers } = hre;
  const issuer = process.env.POINTS_ISSUER_ADDRESS;
  if (!issuer) throw new Error("Missing POINTS_ISSUER_ADDRESS");

  const bonus = BigInt(process.env.POINTS_ACTIVATION_BONUS || "100");

  const Factory = await ethers.getContractFactory("ClovaPoints");
  const contract = await Factory.deploy(issuer, bonus);
  await contract.waitForDeployment();

  console.log("ClovaPoints deployed:", await contract.getAddress());
  console.log("issuer:", issuer);
  console.log("activationBonus:", bonus.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
