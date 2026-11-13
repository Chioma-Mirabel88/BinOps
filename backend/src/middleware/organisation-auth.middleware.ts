import type { Request, Response, NextFunction } from "express";
import { pool } from "../config/database.js";

type OrganisationType =
  | "lawma_authority"
  | "binops"
  | "psp_operator"
  | "recycling_facility";
type MembershipRole = "owner" | "admin" | "operator";

function requireOrganisationAccess(
  organisationType: OrganisationType,
  allowedRoles: MembershipRole[],
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    try {
      const result = await pool.query<{ authorised: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM users u
            JOIN organisation_members om ON om.user_id = u.id
            JOIN organisations o ON o.id = om.organisation_id
            WHERE u.id = $1
              AND u.is_active = TRUE
              AND o.is_active = TRUE
              AND o.organisation_type = $2
              AND om.role = ANY($3::membership_role[])
          ) AS authorised
        `,
        [userId, organisationType, allowedRoles],
      );

      if (!result.rows[0]?.authorised) {
        return res.status(403).json({
          error: "You do not have permission to access this resource.",
        });
      }

      return next();
    } catch {
      return res.status(500).json({
        error: "Unable to verify organisation permissions.",
      });
    }
  };
}

export const requireOversightAccess = requireOrganisationAccess(
  "lawma_authority",
  ["owner", "admin"],
);

export const requireBinOpsAccess = requireOrganisationAccess(
  "binops",
  ["owner", "admin"],
);

export const requirePspAccess = requireOrganisationAccess(
  "psp_operator",
  ["owner", "admin", "operator"],
);
export const requireRecyclerAccess = requireOrganisationAccess(
  "recycling_facility",
  ["owner", "admin", "operator"],
);
