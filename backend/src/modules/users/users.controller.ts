import type { Request, Response } from "express";
import {
  getUserProfile,
  getActivePspOrganisations,
  getActiveRecyclerOrganisations,
} from "./users.service.js";

export async function getMyProfileController(
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
    const profile = await getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        error: "User profile not found.",
      });
    }

    return res.status(200).json({
      user: profile,
    });
  } catch {
    console.error("Profile retrieval failed.");

    return res.status(500).json({
      error: "Could not retrieve user profile.",
    });
  }
}

export async function getActivePspOrganisationsController(
  req: Request,
  res: Response,
) {
  try {
    const organisations = await getActivePspOrganisations();

    return res.status(200).json({
      count: organisations.length,
      organisations,
    });
  } catch {
    console.error("PSP organisation directory retrieval failed.");

    return res.status(500).json({
      error: "Unable to retrieve PSP organisations.",
    });
  }
}


export async function getActiveRecyclerOrganisationsController(
  _req: Request,
  res: Response,
) {
  try {
    const organisations = await getActiveRecyclerOrganisations();

    return res.status(200).json({
      count: organisations.length,
      organisations,
    });
  } catch {
    console.error("Recycler organisation directory retrieval failed.");

    return res.status(500).json({
      error: "Unable to retrieve recycler organisations.",
    });
  }
}
