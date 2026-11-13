import { pool } from "../../config/database.js";

export async function getUserProfile(userId: string) {
  const result = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    is_active: boolean;
    created_at: Date;
    organisation_id: string | null;
    organisation_name: string | null;
    organisation_type: string | null;
    membership_role: string | null;
  }>(
    `SELECT
       u.id,
       u.email,
       u.first_name,
       u.last_name,
       u.phone,
       u.is_active,
       u.created_at,
       o.id AS organisation_id,
       o.name AS organisation_name,
       o.organisation_type,
       om.role AS membership_role
     FROM users u
     LEFT JOIN organisation_members om ON om.user_id = u.id
     LEFT JOIN organisations o ON o.id = om.organisation_id
     WHERE u.id = $1
     ORDER BY o.name`,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const firstRow = result.rows[0];

  if (!firstRow) {
    return null;
  }

  return {
    id: firstRow.id,
    email: firstRow.email,
    firstName: firstRow.first_name,
    lastName: firstRow.last_name,
    phone: firstRow.phone,
    isActive: firstRow.is_active,
    createdAt: firstRow.created_at,
    organisations: result.rows
      .filter((row) => row.organisation_id !== null)
      .map((row) => ({
        id: row.organisation_id,
        name: row.organisation_name,
        type: row.organisation_type,
        role: row.membership_role,
      })),
  };
}

export async function getActivePspOrganisations() {
  const result = await pool.query<{
    id: string;
    name: string;
    service_area: string | null;
  }>(
    `SELECT id, name, service_area
     FROM organisations
     WHERE organisation_type = 'psp_operator'
       AND is_active = TRUE
     ORDER BY name ASC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    serviceArea: row.service_area,
  }));
}
