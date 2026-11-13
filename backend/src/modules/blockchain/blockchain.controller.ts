import type { Request, Response } from "express";
import { getCollectionProofs } from "./blockchain.service.js";

export async function getCollectionProofsController(
  _req: Request,
  res: Response,
) {
  try {
    const proofs = await getCollectionProofs();
    return res.status(200).json({ proofs });
  } catch (error) {
    console.error("Failed to retrieve blockchain proofs:", error);
    return res.status(500).json({
      error: "Unable to retrieve blockchain proofs.",
    });
  }
}
