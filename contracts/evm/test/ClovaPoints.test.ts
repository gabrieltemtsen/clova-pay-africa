import { expect } from "chai";
import hre from "hardhat";

describe("ClovaPoints", function () {
  it("activates once and allows signed claim", async () => {
    const { ethers } = hre;
    const [issuer, user] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ClovaPoints");
    const points = await Factory.deploy(await issuer.getAddress(), 100n);
    await points.waitForDeployment();

    await expect(points.connect(user).activate())
      .to.emit(points, "Activated");

    await expect(points.connect(user).activate()).to.be.revertedWith("already activated");

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const verifyingContract = await points.getAddress();

    const domain = {
      name: "ClovaPoints",
      version: "1",
      chainId,
      verifyingContract,
    };

    const types = {
      Claim: [
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "reason", type: "bytes32" },
        { name: "ref", type: "bytes32" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const reason = ethers.keccak256(ethers.toUtf8Bytes("CASHOUT_CREATED"));
    const ref = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const value = {
      user: await user.getAddress(),
      amount: 25n,
      reason,
      ref,
      deadline,
    };

    const sig = await issuer.signTypedData(domain as any, types as any, value as any);

    await expect(points.connect(user).claim(25n, reason, ref, deadline, sig))
      .to.emit(points, "PointsClaimed");

    await expect(points.connect(user).claim(25n, reason, ref, deadline, sig))
      .to.be.revertedWith("ref used");
  });
});
