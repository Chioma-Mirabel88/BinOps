import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireOversightAccess } from "../../middleware/organisation-auth.middleware.js";
import { getCollectionProofsController } from "./blockchain.controller.js";

const blockchainRouter = Router();

blockchainRouter.use(authenticateToken);
blockchainRouter.get(
  "/proofs",
  requireOversightAccess,
  getCollectionProofsController,
);

export default blockchainRouter;
