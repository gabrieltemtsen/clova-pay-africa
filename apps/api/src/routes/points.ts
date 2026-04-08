import { Router } from "express";
import { z } from "zod";
import { privateKeyToAccount } from "viem/accounts";

const claimSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  reason: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ref: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  deadline: z.string().regex(/^\d+$/),
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const pointsRouter = Router();

/**
 * POST /points/claim-signature
 * Returns an EIP-712 signature authorizing a user to claim points.
 * User still pays gas when they submit `claim(...)` onchain.
 */
pointsRouter.post("/points/claim-signature", async (req, res) => {
  try {
    const body = claimSchema.parse(req.body);

    const pk = process.env.POINTS_SIGNER_PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "POINTS_SIGNER_PRIVATE_KEY not set" });

    // viem expects 0x-prefixed hex; allow raw 64-hex too.
    const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
    const account = privateKeyToAccount(normalizedPk as `0x${string}`);

    const domain = {
      name: "ClovaPoints",
      version: "1",
      chainId: body.chainId,
      verifyingContract: body.verifyingContract as `0x${string}`,
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

    const message = {
      user: body.userAddress as `0x${string}`,
      amount: BigInt(body.amount),
      reason: body.reason as `0x${string}`,
      ref: body.ref as `0x${string}`,
      deadline: BigInt(body.deadline),
    };

    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "Claim",
      message,
    } as any);

    return res.json({
      issuer: account.address,
      signature,
      claim: message,
      domain,
    });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "bad request" });
  }
});
