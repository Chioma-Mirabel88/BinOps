import { z } from "zod";
import type { Request, Response } from "express";
import {
  createHealthCreditFunding,
  confirmHealthCreditFunding,
  issueHealthCredits,
  getHealthCreditBalance,
  redeemHealthCredits,
  getHealthCreditManagementData,
  getHealthcareDirectory,
} from "./health-credits.service.js";
import {
  createFundingSchema,
  issueHealthCreditsSchema,
  redeemHealthCreditsSchema,
} from "./health-credits.schema.js";

export async function createFundingController(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const validation = createFundingSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid funding details.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await createHealthCreditFunding(userId, validation.data);
    if (result.outcome === "duplicate_reference") {
      return res.status(409).json({ error: "Funding reference already exists." });
    }
    return res.status(201).json({
      message: "Health Credit funding recorded as pending.",
      fundingId: result.id,
      status: "pending",
    });
  } catch {
    return res.status(500).json({ error: "Unable to create funding record." });
  }
}

export async function confirmFundingController(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Invalid funding ID." });

  try {
    const result = await confirmHealthCreditFunding(userId, id.data);
    if (result.outcome === "not_authorised") {
      return res.status(403).json({ error: "Oversight authorisation required." });
    }
    if (result.outcome === "not_found") {
      return res.status(404).json({ error: "Funding record not found." });
    }
    if (result.outcome === "not_pending") {
      return res.status(409).json({ error: "Funding record is not pending." });
    }
    return res.status(200).json({
      message: "Funding confirmed successfully.",
      fundingId: result.id,
      status: "confirmed",
    });
  } catch {
    return res.status(500).json({ error: "Unable to confirm funding." });
  }
}

export async function issueHealthCreditsController(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const validation = issueHealthCreditsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid Health Credits issuance details.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await issueHealthCredits(userId, validation.data);

    switch (result.outcome) {
      case "issued":
        return res.status(201).json({
          message: "Health Credits issued successfully.",
          ...result,
        });
      case "duplicate":
        return res.status(409).json({ error: "Idempotency key already used." });
      case "account_not_found":
        return res.status(404).json({ error: "Health Credit account not found." });
      case "account_inactive":
        return res.status(409).json({ error: "Health Credit account is inactive." });
      case "funding_not_found":
        return res.status(404).json({ error: "Funding record not found." });
      case "funding_not_confirmed":
        return res.status(409).json({ error: "Funding must be confirmed before issuance." });
      case "insufficient_funding":
        return res.status(409).json({
          error: "Insufficient confirmed funding.",
          available: result.available,
        });
    }
  } catch {
    return res.status(500).json({ error: "Unable to issue Health Credits." });
  }
}

export async function getHealthCreditBalanceController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const balance = await getHealthCreditBalance(userId);

    if (!balance) {
      return res.status(404).json({
        error: "Health Credit account not found.",
      });
    }

    return res.status(200).json({ balance });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve Health Credit balance.",
    });
  }
}

export async function redeemHealthCreditsController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const validation = redeemHealthCreditsSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid redemption details.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await redeemHealthCredits(userId, validation.data);

    switch (result.outcome) {
      case "redeemed":
        return res.status(201).json({
          message: "Health Credits redeemed successfully.",
          ...result,
        });
      case "not_authorised":
        return res.status(403).json({
          error: "An active hospital or pharmacy membership is required.",
        });
      case "duplicate":
        return res.status(409).json({ error: "Idempotency key already used." });
      case "account_not_found":
        return res.status(404).json({ error: "Health Credit account not found." });
      case "account_inactive":
        return res.status(409).json({ error: "Health Credit account is inactive." });
      case "insufficient_balance":
        return res.status(409).json({
          error: "Insufficient Health Credit balance.",
          available: result.available,
        });
    }
  } catch {
    return res.status(500).json({ error: "Unable to redeem Health Credits." });
  }
}


export async function getHealthCreditManagementController(
  req: Request,
  res: Response,
) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const data = await getHealthCreditManagementData();
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve Health Credit management records.",
    });
  }
}

export async function getHealthcareDirectoryController(
  req: Request,
  res: Response,
) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const partners = await getHealthcareDirectory();
    return res.status(200).json({ partners });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve healthcare directory.",
    });
  }
}
