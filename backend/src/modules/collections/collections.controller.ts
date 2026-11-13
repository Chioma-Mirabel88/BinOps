import { z } from "zod";
import type { Request, Response } from "express";
import { collectionRequestSchema, assignCollectionRequestSchema, updatePspCollectionStatusSchema, createWasteHandoverSchema } from "./collections.schema.js";
import {
  createCollectionRequest,
  getCustomerCollectionRequests,
  cancelCustomerCollectionRequest,
  getPendingCollectionRequests,
  assignCollectionRequest,
  getPspAssignedCollectionRequests,
  getPspAvailableCollectionRequests,
  getPspHandoverFacilities,
  acceptPspCollectionRequest,
  updatePspCollectionStatus,
  createWasteHandover,
  verifyCollectionRequest,
  getRecyclerIncomingHandovers,
} from "./collections.service.js";

export async function createCollectionRequestController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  const validation = collectionRequestSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid collection request.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const collectionRequest = await createCollectionRequest(
      userId,
      validation.data,
    );

    if (!collectionRequest) {
      return res.status(403).json({
        error: "Account is inactive or unavailable.",
      });
    }

    return res.status(201).json({
      message: "Collection request created successfully.",
      collectionRequest,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to create collection request.",
    });
  }
}


export async function getCustomerCollectionRequestsController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const collectionRequests = await getCustomerCollectionRequests(userId);

    return res.status(200).json({
      count: collectionRequests.length,
      collectionRequests,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve collection history.",
    });
  }
}


export async function cancelCustomerCollectionRequestController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;
  const requestId = req.params.id;

  if (!userId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  if (typeof requestId !== "string" || !requestId.trim()) {
    return res.status(400).json({
      error: "A valid collection request ID is required.",
    });
  }

  try {
    const result = await cancelCustomerCollectionRequest(userId, requestId);

    if (result.outcome === "not_found") {
      return res.status(404).json({
        error: "Collection request not found.",
      });
    }

    if (result.outcome === "not_cancellable") {
      return res.status(409).json({
        error: "Collection request can no longer be cancelled.",
        currentStatus: result.currentStatus,
      });
    }

    return res.status(200).json({
      message: "Collection request cancelled successfully.",
      collectionRequestId: result.id,
      status: "cancelled",
    });
  } catch {
    return res.status(500).json({
      error: "Unable to cancel collection request.",
    });
  }
}


export async function getPendingCollectionRequestsController(
  req: Request,
  res: Response,
) {
  if (!req.auth?.userId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const collectionRequests = await getPendingCollectionRequests();

    return res.status(200).json({
      count: collectionRequests.length,
      collectionRequests,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve pending collection requests.",
    });
  }
}

export async function assignCollectionRequestController(
  req: Request,
  res: Response,
) {
  const oversightUserId = req.auth?.userId;

  if (!oversightUserId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  const idValidation = z.string().uuid().safeParse(req.params.id);
  const bodyValidation = assignCollectionRequestSchema.safeParse(req.body);

  if (!idValidation.success || !bodyValidation.success) {
    return res.status(400).json({
      error: "A valid collection request ID and PSP organisation ID are required.",
    });
  }

  try {
    const result = await assignCollectionRequest(
      oversightUserId,
      idValidation.data,
      bodyValidation.data,
    );

    if (result.outcome === "not_found") {
      return res.status(404).json({
        error: "Collection request not found.",
      });
    }

    if (result.outcome === "invalid_psp") {
      return res.status(422).json({
        error: "The selected PSP organisation is invalid or inactive.",
      });
    }

    if (result.outcome === "not_assignable") {
      return res.status(409).json({
        error: "Collection request cannot be assigned in its current state.",
        currentStatus: result.currentStatus,
      });
    }

    return res.status(200).json({
      message: "Collection request assigned successfully.",
      collectionRequest: result,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to assign collection request.",
    });
  }
}


export async function getPspAssignedCollectionRequestsController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const collectionRequests = await getPspAssignedCollectionRequests(userId);

    return res.status(200).json({
      count: collectionRequests.length,
      collectionRequests,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve PSP collection requests.",
    });
  }
}

export async function getPspAvailableCollectionRequestsController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const collectionRequests = await getPspAvailableCollectionRequests();

    return res.status(200).json({
      count: collectionRequests.length,
      collectionRequests,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to retrieve available PSP collection requests.",
    });
  }
}

export async function acceptPspCollectionRequestController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({
      error: "Invalid collection request ID.",
    });
  }

  try {
    const result = await acceptPspCollectionRequest(userId, params.data.id);

    if (result.outcome === "no_psp_organisation") {
      return res.status(403).json({
        error: "No active PSP organisation is linked to this account.",
      });
    }

    if (result.outcome === "multiple_psp_organisations") {
      return res.status(409).json({
        error: "This account belongs to multiple PSP organisations. Please resolve the organisation selection first.",
      });
    }

    if (result.outcome === "not_found") {
      return res.status(404).json({
        error: "Collection request not found.",
      });
    }

    if (result.outcome === "not_assignable") {
      return res.status(409).json({
        error: "This collection request has already been accepted or is no longer available.",
        currentStatus: result.currentStatus,
      });
    }

    return res.status(200).json({
      message: "Collection request accepted successfully.",
      collectionRequest: result,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to accept collection request.",
    });
  }
}

export async function updatePspCollectionStatusController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  const validation = updatePspCollectionStatusSchema.safeParse(req.body);

  if (!params.success || !validation.success) {
    return res.status(400).json({
      error: "Invalid collection request ID or status update.",
      details: validation.success ? undefined : validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await updatePspCollectionStatus(
      userId,
      params.data.id,
      validation.data,
    );

    if (result.outcome === "not_found") {
      return res.status(404).json({
        error: "Collection request not found.",
      });
    }

    if (result.outcome === "invalid_transition") {
      return res.status(409).json({
        error: "Invalid collection status transition.",
        currentStatus: result.currentStatus,
      });
    }

    return res.status(200).json({
      message: "Collection status updated successfully.",
      collectionRequest: result,
    });
  } catch (error) {
    console.error("PSP collection status update failed:", error);
    return res.status(500).json({
      error: "Unable to update collection status.",
    });
  }
}

export async function createWasteHandoverController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  const validation = createWasteHandoverSchema.safeParse(req.body);

  if (!params.success || !validation.success) {
    return res.status(400).json({
      error: "Invalid collection request ID or handover details.",
      details: validation.success
        ? undefined
        : validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await createWasteHandover(
      userId,
      params.data.id,
      validation.data,
    );

    if (result.outcome === "not_found") {
      return res.status(404).json({
        error: "Collection request not found.",
      });
    }

    if (result.outcome === "invalid_status") {
      return res.status(409).json({
        error: "Collection must be marked collected before handover.",
        currentStatus: result.currentStatus,
      });
    }

    if (result.outcome === "invalid_facility") {
      return res.status(422).json({
        error: "Facility is not approved or does not serve this collection area.",
      });
    }

    return res.status(201).json({
      message: "Waste handover recorded successfully.",
      handover: result,
    });
  } catch (error) {
    console.error("PSP waste handover creation failed:", error);
    return res.status(500).json({
      error: "Unable to record waste handover.",
    });
  }
}

export async function verifyCollectionRequestController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({ error: "Invalid collection request ID." });
  }

  try {
    const result = await verifyCollectionRequest(userId, params.data.id);

    if (result.outcome === "not_authorised") {
      return res.status(403).json({ error: "Oversight access denied." });
    }

    if (result.outcome === "not_found") {
      return res.status(404).json({ error: "Collection request not found." });
    }

    if (result.outcome === "invalid_status") {
      return res.status(409).json({
        error: "Collection must be marked collected before verification.",
        currentStatus: result.currentStatus,
      });
    }

    if (result.outcome === "missing_handover") {
      return res.status(409).json({
        error: "An approved facility handover is required before verification.",
      });
    }

    return res.status(200).json({
      message: "Collection verified successfully.",
      verification: result,
    });
  } catch (error) {
    console.error("Oversight collection verification failed:", error);
    return res.status(500).json({
      error: "Unable to verify collection.",
    });
  }
}


export async function getRecyclerIncomingHandoversController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const handovers = await getRecyclerIncomingHandovers(userId);

    return res.status(200).json({
      count: handovers.length,
      handovers,
    });
  } catch (error) {
    console.error("Recycler incoming handovers retrieval failed:", error);
    return res.status(500).json({
      error: "Unable to load incoming handovers.",
    });
  }
}

export async function getPspHandoverFacilitiesController(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({ error: "Invalid collection request ID." });
  }

  try {
    const facilities = await getPspHandoverFacilities(userId, params.data.id);

    if (facilities === null) {
      return res.status(404).json({
        error: "Collected request not found or not accessible to this PSP.",
      });
    }

    return res.status(200).json({
      count: facilities.length,
      facilities,
    });
  } catch (error) {
    console.error("PSP handover facilities retrieval failed:", error);
    return res.status(500).json({
      error: "Unable to load approved recycling facilities.",
    });
  }
}
