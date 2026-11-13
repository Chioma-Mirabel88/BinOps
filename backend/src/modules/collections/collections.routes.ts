import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireOversightAccess, requirePspAccess, requireRecyclerAccess } from "../../middleware/organisation-auth.middleware.js";
import {
  createCollectionRequestController,
  getCustomerCollectionRequestsController,
  cancelCustomerCollectionRequestController,
  getPendingCollectionRequestsController,
  assignCollectionRequestController,
  getPspAssignedCollectionRequestsController,
  getPspAvailableCollectionRequestsController,
  getPspHandoverFacilitiesController,
  acceptPspCollectionRequestController,
  updatePspCollectionStatusController,
  createWasteHandoverController,
  verifyCollectionRequestController,
  getRecyclerIncomingHandoversController,
} from "./collections.controller.js";

const collectionsRouter = Router();

collectionsRouter.post(
  "/",
  authenticateToken,
  createCollectionRequestController,
);

collectionsRouter.get(
  "/",
  authenticateToken,
  getCustomerCollectionRequestsController,
);

collectionsRouter.patch(
  "/:id/cancel",
  authenticateToken,
  cancelCustomerCollectionRequestController,
);

export default collectionsRouter;


export const oversightCollectionsRouter = Router();

oversightCollectionsRouter.get(
  "/pending",
  authenticateToken,
  requireOversightAccess,
  getPendingCollectionRequestsController,
);

oversightCollectionsRouter.patch(
  "/:id/assign",
  authenticateToken,
  requireOversightAccess,
  assignCollectionRequestController,
);

oversightCollectionsRouter.patch(
  "/:id/verify",
  authenticateToken,
  requireOversightAccess,
  verifyCollectionRequestController,
);

export const pspCollectionsRouter = Router();

pspCollectionsRouter.get(
  "/available",
  authenticateToken,
  requirePspAccess,
  getPspAvailableCollectionRequestsController,
  getPspHandoverFacilitiesController,
);

pspCollectionsRouter.post(
  "/:id/accept",
  authenticateToken,
  requirePspAccess,
  acceptPspCollectionRequestController,
);

pspCollectionsRouter.get(
  "/",
  authenticateToken,
  requirePspAccess,
  getPspAssignedCollectionRequestsController,
);

pspCollectionsRouter.patch(
  "/:id/status",
  authenticateToken,
  requirePspAccess,
  updatePspCollectionStatusController,
);

pspCollectionsRouter.post(
  "/:id/handover",
  authenticateToken,
  requirePspAccess,
  createWasteHandoverController,
);

export const recyclerCollectionsRouter = Router();

recyclerCollectionsRouter.get(
  "/handovers",
  authenticateToken,
  requireRecyclerAccess,
  getRecyclerIncomingHandoversController,
);

pspCollectionsRouter.get(
  "/:id/handover-facilities",
  authenticateToken,
  requirePspAccess,
  getPspHandoverFacilitiesController,
);
