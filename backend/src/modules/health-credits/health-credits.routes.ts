import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireBinOpsAccess } from "../../middleware/organisation-auth.middleware.js";
import {
  createFundingController,
  confirmFundingController,
  issueHealthCreditsController,
  getHealthCreditBalanceController,
  redeemHealthCreditsController,
  getHealthcareDirectoryController,
  getHealthCreditManagementController,
} from "./health-credits.controller.js";

const healthCreditsRouter = Router();

healthCreditsRouter.use(authenticateToken);

healthCreditsRouter.get("/management", requireBinOpsAccess, getHealthCreditManagementController);
healthCreditsRouter.post("/funding", requireBinOpsAccess, createFundingController);
healthCreditsRouter.patch("/funding/:id/confirm", requireBinOpsAccess, confirmFundingController);
healthCreditsRouter.post("/issuance", requireBinOpsAccess, issueHealthCreditsController);

export default healthCreditsRouter;

export const customerHealthCreditsRouter = Router();

customerHealthCreditsRouter.get(
  "/balance",
  authenticateToken,
  getHealthCreditBalanceController,
);

export const healthcarePartnerHealthCreditsRouter = Router();

healthcarePartnerHealthCreditsRouter.get(
  "/directory",
  authenticateToken,
  getHealthcareDirectoryController,
);

healthcarePartnerHealthCreditsRouter.post(
  "/redemptions",
  authenticateToken,
  redeemHealthCreditsController,
);
