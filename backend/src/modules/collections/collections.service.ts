import { createHash } from "node:crypto";
import { id } from "ethers";
import { recordCollectionProof } from "../blockchain/blockchain.service.js";
import { env } from "../../config/env.js";
import { pool } from "../../config/database.js";
import { processPendingCollectionRewards } from "../health-credits/collection-rewards.service.js";
import { encryptAddress, decryptAddress } from "../../utils/address-encryption.js";
import type { AssignCollectionRequestInput, CollectionRequestInput, CreateWasteHandoverInput, UpdatePspCollectionStatusInput } from "./collections.schema.js";

export interface CreatedCollectionRequest {
  id: string;
  serviceArea: string;
  wasteCategory: string;
  binFullness: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date | null;
}

export async function createCollectionRequest(
  userId: string,
  input: CollectionRequestInput,
): Promise<CreatedCollectionRequest | null> {
  const encryptedAddress = encryptAddress(input.serviceAddress);

  const result = await pool.query<CreatedCollectionRequest>(
    `
      INSERT INTO collection_requests (
        customer_user_id,
        service_address_ciphertext,
        service_address_key_version,
        service_area,
        waste_category,
        bin_fullness
      )
      SELECT
        u.id,
        $2,
        $3,
        $4,
        $5,
        $6
      FROM users u
      WHERE u.id = $1
        AND u.is_active = TRUE
      RETURNING
        id,
        service_area AS "serviceArea",
        waste_category AS "wasteCategory",
        bin_fullness AS "binFullness",
        status,
        requested_at AS "requestedAt",
        scheduled_for AS "scheduledFor"
    `,
    [
      userId,
      encryptedAddress,
      env.COLLECTION_ADDRESS_KEY_VERSION,
      input.serviceArea,
      input.wasteCategory,
      input.binFullness,
    ],
  );

  return result.rows[0] ?? null;
}


interface StoredCollectionRequest {
  id: string;
  serviceAddressCiphertext: Buffer;
  serviceArea: string;
  wasteCategory: string | null;
  binFullness: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date | null;
  completedAt: Date | null;
}

export interface CustomerCollectionRequest {
  id: string;
  serviceAddress: string;
  serviceArea: string;
  wasteCategory: string | null;
  binFullness: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date | null;
  completedAt: Date | null;
}

export async function getCustomerCollectionRequests(
  userId: string,
): Promise<CustomerCollectionRequest[]> {
  const result = await pool.query<StoredCollectionRequest>(
    `
      SELECT
        id,
        service_address_ciphertext AS "serviceAddressCiphertext",
        service_area AS "serviceArea",
        waste_category AS "wasteCategory",
        bin_fullness AS "binFullness",
        status,
        requested_at AS "requestedAt",
        scheduled_for AS "scheduledFor",
        completed_at AS "completedAt"
      FROM collection_requests
      WHERE customer_user_id = $1
      ORDER BY requested_at DESC
      LIMIT 50
    `,
    [userId],
  );

  return result.rows.map((request) => ({
    id: request.id,
    serviceAddress: decryptAddress(request.serviceAddressCiphertext),
    serviceArea: request.serviceArea,
    wasteCategory: request.wasteCategory,
    binFullness: request.binFullness,
    status: request.status,
    requestedAt: request.requestedAt,
    scheduledFor: request.scheduledFor,
    completedAt: request.completedAt,
  }));
}


export type CancelCollectionResult =
  | { outcome: "cancelled"; id: string }
  | { outcome: "not_found" }
  | { outcome: "not_cancellable"; currentStatus: string };

export async function cancelCustomerCollectionRequest(
  userId: string,
  requestId: string,
): Promise<CancelCollectionResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updateResult = await client.query<{ id: string }>(
      `
        UPDATE collection_requests
        SET status = 'cancelled'
        WHERE id = $1
          AND customer_user_id = $2
          AND status IN ('requested', 'assigned', 'scheduled')
        RETURNING id
      `,
      [requestId, userId],
    );

    if (updateResult.rows.length === 0) {
      const existingResult = await client.query<{ status: string }>(
        `
          SELECT status
          FROM collection_requests
          WHERE id = $1
            AND customer_user_id = $2
        `,
        [requestId, userId],
      );

      await client.query("COMMIT");

      if (existingResult.rows.length === 0) {
        return { outcome: "not_found" };
      }

      return {
        outcome: "not_cancellable",
        currentStatus: existingResult.rows[0]!.status,
      };
    }

    const collectionRequestId = updateResult.rows[0]!.id;

    await client.query(
      `
        INSERT INTO collection_events (
          collection_request_id,
          actor_user_id,
          event_type,
          notes
        )
        VALUES ($1, $2, 'collection_cancelled', $3)
      `,
      [
        collectionRequestId,
        userId,
        "Collection request cancelled by customer.",
      ],
    );

    await client.query("COMMIT");

    return {
      outcome: "cancelled",
      id: collectionRequestId,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export interface PendingCollectionRequest {
  id: string;
  serviceArea: string;
  wasteCategory: string | null;
  binFullness: string;
  status: string;
  requestedAt: Date;
  pspOrganisationId: string | null;
  pspOrganisationName: string | null;
  customerName: string;
}

export async function getPendingCollectionRequests(): Promise<PendingCollectionRequest[]> {
  const result = await pool.query<PendingCollectionRequest>(
    `
      SELECT
        id,
        service_area AS "serviceArea",
        waste_category AS "wasteCategory",
        bin_fullness AS "binFullness",
        status,
        cr.requested_at AS "requestedAt",
        cr.assigned_psp_organisation_id AS "pspOrganisationId",
        psp.name AS "pspOrganisationName",
        COALESCE(
          (
            SELECT o.name
            FROM organisation_members om
            JOIN organisations o ON o.id = om.organisation_id
            WHERE om.user_id = cr.customer_user_id
              AND o.organisation_type NOT IN ('lawma_authority', 'psp_operator')
            LIMIT 1
          ),
          CONCAT_WS(' ', u.first_name, u.last_name)
        ) AS "customerName"
      FROM collection_requests cr
      LEFT JOIN organisations psp
        ON psp.id = cr.assigned_psp_organisation_id
      JOIN users u ON u.id = cr.customer_user_id
      WHERE cr.status IN (
        'requested',
        'assigned',
        'scheduled',
        'in_progress',
        'collected'
      )
      ORDER BY requested_at ASC
      LIMIT 100
    `,
  );

  return result.rows;
}

export type AssignCollectionOutcome =
  | {
      outcome: "assigned";
      id: string;
      pspOrganisationId: string;
      status: string;
    }
  | { outcome: "invalid_psp" }
  | { outcome: "not_found" }
  | { outcome: "not_assignable"; currentStatus: string };

export async function assignCollectionRequest(
  oversightUserId: string,
  collectionRequestId: string,
  input: AssignCollectionRequestInput,
): Promise<AssignCollectionOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const psp = await client.query<{ id: string }>(
      `
        SELECT id
        FROM organisations
        WHERE id = $1
          AND organisation_type = 'psp_operator'
          AND is_active = TRUE
        FOR SHARE
      `,
      [input.pspOrganisationId],
    );

    if (psp.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "invalid_psp" };
    }

    const assignment = await client.query<{
      id: string;
      status: string;
    }>(
      `
        UPDATE collection_requests
        SET
          assigned_psp_organisation_id = $2,
          status = 'assigned'
        WHERE id = $1
          AND status = 'requested'
          AND assigned_psp_organisation_id IS NULL
        RETURNING id, status
      `,
      [collectionRequestId, input.pspOrganisationId],
    );

    if (assignment.rowCount === 0) {
      const existing = await client.query<{ status: string }>(
        `
          SELECT status
          FROM collection_requests
          WHERE id = $1
        `,
        [collectionRequestId],
      );

      await client.query("ROLLBACK");

      if (existing.rowCount === 0) {
        return { outcome: "not_found" };
      }

      return {
        outcome: "not_assignable",
        currentStatus: existing.rows[0]!.status,
      };
    }

    await client.query(
      `
        INSERT INTO collection_events (
          collection_request_id,
          actor_user_id,
          event_type,
          notes
        )
        VALUES ($1, $2, 'operator_assigned', $3)
      `,
      [
        collectionRequestId,
        oversightUserId,
        "Collection request assigned to a PSP operator.",
      ],
    );

    await client.query("COMMIT");

    return {
      outcome: "assigned",
      id: assignment.rows[0]!.id,
      pspOrganisationId: input.pspOrganisationId,
      status: assignment.rows[0]!.status,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export interface PspAvailableCollectionRequest {
  id: string;
  serviceArea: string;
  wasteCategory: string;
  binFullness: string;
  status: string;
  requestedAt: Date;
  customerName: string;
}

export async function getPspAvailableCollectionRequests(): Promise<PspAvailableCollectionRequest[]> {
  const result = await pool.query<PspAvailableCollectionRequest>(
    `
      SELECT
        cr.id,
        cr.service_area AS "serviceArea",
        cr.waste_category AS "wasteCategory",
        cr.bin_fullness AS "binFullness",
        cr.status,
        cr.requested_at AS "requestedAt",
        COALESCE(
          (
            SELECT customer_org.name
            FROM organisation_members customer_member
            JOIN organisations customer_org
              ON customer_org.id = customer_member.organisation_id
            WHERE customer_member.user_id = cr.customer_user_id
              AND customer_org.organisation_type NOT IN ('lawma_authority', 'psp_operator')
            LIMIT 1
          ),
          CONCAT_WS(' ', customer.first_name, customer.last_name)
        ) AS "customerName"
      FROM collection_requests cr
      JOIN users customer ON customer.id = cr.customer_user_id
      WHERE cr.status = 'requested'
        AND cr.assigned_psp_organisation_id IS NULL
        AND cr.waste_category = 'general'
        AND customer.is_active = TRUE
      ORDER BY cr.requested_at ASC
      LIMIT 100
    `,
  );

  return result.rows;
}

export type AcceptPspCollectionOutcome =
  | {
      outcome: "accepted";
      id: string;
      pspOrganisationId: string;
      status: string;
    }
  | { outcome: "no_psp_organisation" }
  | { outcome: "multiple_psp_organisations" }
  | { outcome: "not_found" }
  | { outcome: "not_assignable"; currentStatus: string };

export async function acceptPspCollectionRequest(
  operatorUserId: string,
  collectionRequestId: string,
): Promise<AcceptPspCollectionOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const memberships = await client.query<{ id: string }>(
      `
        SELECT o.id
        FROM organisations o
        JOIN organisation_members om
          ON om.organisation_id = o.id
        JOIN users u
          ON u.id = om.user_id
        WHERE om.user_id = $1
          AND om.role IN ('owner', 'admin', 'operator')
          AND u.is_active = TRUE
          AND o.is_active = TRUE
          AND o.organisation_type = 'psp_operator'
        ORDER BY o.created_at ASC
        FOR SHARE OF o
      `,
      [operatorUserId],
    );

    if (memberships.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "no_psp_organisation" };
    }

    if (memberships.rows.length > 1) {
      await client.query("ROLLBACK");
      return { outcome: "multiple_psp_organisations" };
    }

    const pspOrganisationId = memberships.rows[0]!.id;

    const assignment = await client.query<{ id: string; status: string }>(
      `
        UPDATE collection_requests
        SET
          assigned_psp_organisation_id = $2,
          status = 'assigned'
        WHERE id = $1
          AND status = 'requested'
          AND assigned_psp_organisation_id IS NULL
          AND waste_category = 'general'
        RETURNING id, status
      `,
      [collectionRequestId, pspOrganisationId],
    );

    if (assignment.rowCount === 0) {
      const existing = await client.query<{ status: string }>(
        `
          SELECT status
          FROM collection_requests
          WHERE id = $1
        `,
        [collectionRequestId],
      );

      await client.query("ROLLBACK");

      if (existing.rowCount === 0) {
        return { outcome: "not_found" };
      }

      return {
        outcome: "not_assignable",
        currentStatus: existing.rows[0]!.status,
      };
    }

    await client.query(
      `
        INSERT INTO collection_events (
          collection_request_id,
          actor_user_id,
          event_type,
          notes
        )
        VALUES ($1, $2, 'operator_assigned', $3)
      `,
      [
        collectionRequestId,
        operatorUserId,
        "Collection request accepted by a PSP operator.",
      ],
    );

    await client.query("COMMIT");

    return {
      outcome: "accepted",
      id: assignment.rows[0]!.id,
      pspOrganisationId,
      status: assignment.rows[0]!.status,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface PspAssignedCollectionRequest {
  id: string;
  serviceAddressCiphertext: Buffer;
  serviceArea: string;
  wasteCategory: string | null;
  binFullness: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date | null;
  completedAt: Date | null;
  pspOrganisationId: string;
  pspOrganisationName: string;
  customerName: string;
}

export async function getPspAssignedCollectionRequests(
  operatorUserId: string,
): Promise<Omit<PspAssignedCollectionRequest, "serviceAddressCiphertext">[]> {
  const result = await pool.query<PspAssignedCollectionRequest>(
    `
      SELECT
        cr.id,
        cr.service_address_ciphertext AS "serviceAddressCiphertext",
        cr.service_area AS "serviceArea",
        cr.waste_category AS "wasteCategory",
        cr.bin_fullness AS "binFullness",
        cr.status,
        cr.requested_at AS "requestedAt",
        cr.scheduled_for AS "scheduledFor",
        cr.completed_at AS "completedAt",
        cr.assigned_psp_organisation_id AS "pspOrganisationId",
        o.name AS "pspOrganisationName",
        COALESCE(
          (
            SELECT customer_org.name
            FROM organisation_members customer_member
            JOIN organisations customer_org
              ON customer_org.id = customer_member.organisation_id
            WHERE customer_member.user_id = cr.customer_user_id
              AND customer_org.organisation_type NOT IN ('lawma_authority', 'psp_operator')
            LIMIT 1
          ),
          CONCAT_WS(' ', customer.first_name, customer.last_name)
        ) AS "customerName"
      FROM collection_requests cr
      JOIN users customer ON customer.id = cr.customer_user_id
      JOIN organisations o
        ON o.id = cr.assigned_psp_organisation_id
      JOIN organisation_members om
        ON om.organisation_id = o.id
      JOIN users u
        ON u.id = om.user_id
      WHERE om.user_id = $1
        AND om.role IN ('owner', 'admin', 'operator')
        AND u.is_active = TRUE
        AND o.is_active = TRUE
        AND o.organisation_type = 'psp_operator'
        AND cr.status IN (
          'assigned', 'scheduled', 'in_progress', 'collected', 'verified'
        )
      ORDER BY cr.requested_at ASC
      LIMIT 100
    `,
    [operatorUserId],
  );

  return result.rows.map(({ serviceAddressCiphertext, ...request }) => ({
    ...request,
    serviceAddress: decryptAddress(serviceAddressCiphertext),
  })) as Omit<PspAssignedCollectionRequest, "serviceAddressCiphertext">[];
}

export type UpdatePspCollectionOutcome =
  | {
      outcome: "updated";
      id: string;
      status: string;
      scheduledFor: Date | null;
      completedAt: Date | null;
      rewardStatus: "issued" | "pending" | "not_applicable";
      healthCreditsReward: string | null;
      blockchainStatus: "confirmed" | "failed" | "not_applicable";
      blockchainTransactionHash: string | null;
    }
  | { outcome: "not_found" }
  | { outcome: "invalid_transition"; currentStatus: string };


async function recordPspCollectionBlockchainProof(input: {
  collectionRequestId: string;
  collectedWeightKg: number;
  pspOrganisationId: string;
  completedAt: Date | null;
}): Promise<{
  status: "confirmed" | "failed";
  transactionHash: string | null;
}> {
  const collectionReference = id(input.collectionRequestId);
  const evidenceHash = `0x${createHash("sha256")
    .update(JSON.stringify({
      collectionRequestId: input.collectionRequestId,
      collectedWeightKg: input.collectedWeightKg.toFixed(2),
      pspOrganisationId: input.pspOrganisationId,
      completedAt: input.completedAt?.toISOString() ?? null,
    }))
    .digest("hex")}`;

  try {
    const inserted = await pool.query<{ id: string }>(
      `
        INSERT INTO collection_blockchain_proofs (
          collection_request_id,
          chain_id,
          contract_address,
          collection_reference,
          evidence_hash,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'pending')
        ON CONFLICT (collection_request_id) DO NOTHING
        RETURNING id
      `,
      [
        input.collectionRequestId,
        env.BLOCKCHAIN_CHAIN_ID,
        env.BLOCKCHAIN_CONTRACT_ADDRESS,
        collectionReference,
        evidenceHash,
      ],
    );

    // Never blindly resubmit an existing pending/failed proof:
    // its previous blockchain transaction may have succeeded.
    if (!inserted.rowCount) {
      const existing = await pool.query<{
        status: string;
        transactionHash: string | null;
      }>(
        `
          SELECT status, transaction_hash AS "transactionHash"
          FROM collection_blockchain_proofs
          WHERE collection_request_id = $1
        `,
        [input.collectionRequestId],
      );

      return {
        status: existing.rows[0]?.status === "confirmed"
          ? "confirmed"
          : "failed",
        transactionHash: existing.rows[0]?.transactionHash ?? null,
      };
    }

    const proof = await recordCollectionProof(
      input.collectionRequestId,
      evidenceHash,
    );

    await pool.query(
      `
        UPDATE collection_blockchain_proofs
        SET status = 'confirmed',
            transaction_hash = $2,
            confirmed_at = NOW()
        WHERE collection_request_id = $1
      `,
      [input.collectionRequestId, proof.transactionHash],
    );

    return {
      status: "confirmed",
      transactionHash: proof.transactionHash,
    };
  } catch (error) {
    console.error("PSP collection blockchain proof failed:", error);

    try {
      await pool.query(
        `
          UPDATE collection_blockchain_proofs
          SET status = 'failed'
          WHERE collection_request_id = $1
            AND status = 'pending'
        `,
        [input.collectionRequestId],
      );
    } catch (trackingError) {
      console.error("Could not update PSP blockchain proof status:", trackingError);
    }

    return { status: "failed", transactionHash: null };
  }
}

export async function updatePspCollectionStatus(
  operatorUserId: string,
  collectionRequestId: string,
  input: UpdatePspCollectionStatusInput,
): Promise<UpdatePspCollectionOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const request = await client.query<{
      status: string;
      customerUserId: string | null;
      customerOrganisationId: string | null;
      pspOrganisationId: string;
    }>(
      `
        SELECT
          cr.status,
          cr.customer_user_id AS "customerUserId",
          cr.customer_organisation_id AS "customerOrganisationId",
          o.id AS "pspOrganisationId"
        FROM collection_requests cr
        JOIN organisations o
          ON o.id = cr.assigned_psp_organisation_id
        JOIN organisation_members om
          ON om.organisation_id = o.id
        JOIN users u ON u.id = om.user_id
        WHERE cr.id = $1
          AND om.user_id = $2
          AND om.role IN ('owner', 'admin', 'operator')
          AND u.is_active = TRUE
          AND o.is_active = TRUE
          AND o.organisation_type = 'psp_operator'
        FOR UPDATE OF cr
      `,
      [collectionRequestId, operatorUserId],
    );

    if (!request.rowCount) {
      await client.query("ROLLBACK");
      return { outcome: "not_found" };
    }

    const collection = request.rows[0]!;
    const currentStatus = collection.status;

    const transitions: Record<string, { next: string; event: string }> = {
      assigned: { next: "scheduled", event: "collection_scheduled" },
      scheduled: { next: "in_progress", event: "collection_started" },
      in_progress: { next: "collected", event: "waste_collected" },
    };

    const transition = transitions[currentStatus];

    if (!transition || transition.next !== input.status) {
      await client.query("ROLLBACK");
      return { outcome: "invalid_transition", currentStatus };
    }

    const updated = await client.query<{
      id: string;
      status: string;
      scheduledFor: Date | null;
      completedAt: Date | null;
    }>(
      `
        UPDATE collection_requests
        SET
          status = $2::collection_status,
          scheduled_for = COALESCE($3::timestamptz, scheduled_for),
          completed_at = CASE
            WHEN $4::boolean THEN NOW()
            ELSE completed_at
          END,
          collected_weight_kg = CASE
            WHEN $4::boolean THEN $5::numeric
            ELSE collected_weight_kg
          END
        WHERE id = $1
        RETURNING
          id,
          status,
          scheduled_for AS "scheduledFor",
          completed_at AS "completedAt"
      `,
      [
        collectionRequestId,
        input.status,
        input.scheduledFor ?? null,
        input.status === "collected",
        input.status === "collected" ? input.collectedWeightKg : null,
      ],
    );

    await client.query(
      `
        INSERT INTO collection_events (
          collection_request_id, actor_user_id, event_type, notes
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        collectionRequestId,
        operatorUserId,
        transition.event,
        input.status === "collected"
          ? `PSP operator recorded collection of ${input.collectedWeightKg} KG.`
          : `PSP operator updated collection status to ${input.status}.`,
      ],
    );

    let rewardStatus: "issued" | "pending" | "not_applicable" =
      "not_applicable";
    let healthCreditsReward: string | null = null;

    if (input.status === "collected" && collection.customerUserId) {
      const weight = input.collectedWeightKg!;
      const rewardAmount = weight * 5;

      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        throw new Error("Calculated Health Credits reward is invalid.");
      }

      const account = await client.query<{ id: string }>(
        `
          INSERT INTO health_credit_accounts (owner_user_id)
          VALUES ($1)
          ON CONFLICT (owner_user_id)
          DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
          RETURNING id
        `,
        [collection.customerUserId],
      );

      const accountId = account.rows[0]!.id;

      const pending = await client.query<{ id: string }>(
        `
          INSERT INTO health_credit_pending_rewards (
            collection_request_id,
            account_id,
            weight_kg,
            reward_amount
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (collection_request_id) DO NOTHING
          RETURNING id
        `,
        [
          collectionRequestId,
          accountId,
          weight.toFixed(2),
          rewardAmount.toFixed(2),
        ],
      );

      if (!pending.rowCount) {
        throw new Error(
          "A Health Credits reward already exists for this collection.",
        );
      }

      await client.query(
        `
          INSERT INTO audit_logs (
            actor_user_id, actor_organisation_id, action,
            entity_type, entity_id, metadata
          )
          VALUES ($1, $2, 'health_credits_reward_pending',
                  'health_credit_pending_reward', $3, $4::jsonb)
        `,
        [
          operatorUserId,
          collection.pspOrganisationId,
          pending.rows[0]!.id,
          JSON.stringify({
            collectionRequestId,
            accountId,
            weightKg: weight.toFixed(2),
            rateBhcPerKg: 5,
            rewardAmountBhc: rewardAmount.toFixed(2),
            currency: "BHC",
          }),
        ],
      );

      await processPendingCollectionRewards(client, {
        userId: operatorUserId,
        organisationId: collection.pspOrganisationId,
      });

      const reward = await client.query<{ status: string }>(
        `
          SELECT status
          FROM health_credit_pending_rewards
          WHERE id = $1
        `,
        [pending.rows[0]!.id],
      );

      rewardStatus =
        reward.rows[0]?.status === "issued" ? "issued" : "pending";
      healthCreditsReward = rewardAmount.toFixed(2);
    }

    await client.query("COMMIT");

    let blockchainStatus: "confirmed" | "failed" | "not_applicable" =
      "not_applicable";
    let blockchainTransactionHash: string | null = null;

    if (input.status === "collected") {
      const proof = await recordPspCollectionBlockchainProof({
        collectionRequestId,
        collectedWeightKg: input.collectedWeightKg!,
        pspOrganisationId: collection.pspOrganisationId,
        completedAt: updated.rows[0]!.completedAt,
      });
      blockchainStatus = proof.status;
      blockchainTransactionHash = proof.transactionHash;
    }

    return {
      outcome: "updated",
      ...updated.rows[0]!,
      rewardStatus,
      healthCreditsReward,
      blockchainStatus,
      blockchainTransactionHash,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type CreateWasteHandoverOutcome =
  | {
      outcome: "created";
      id: string;
      collectionRequestId: string;
      facilityId: string;
      wasteCategory: string;
      quantity: string;
      quantityUnit: string;
      receivedAt: Date;
    }
  | { outcome: "not_found" }
  | { outcome: "invalid_status"; currentStatus: string }
  | { outcome: "invalid_facility" };

export async function createWasteHandover(
  operatorUserId: string,
  collectionRequestId: string,
  input: CreateWasteHandoverInput,
): Promise<CreateWasteHandoverOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const request = await client.query<{
      id: string;
      serviceArea: string;
      status: string;
    }>(
      `
        SELECT cr.id, cr.service_area AS "serviceArea", cr.status
        FROM collection_requests cr
        JOIN organisation_members om
          ON om.organisation_id = cr.assigned_psp_organisation_id
        JOIN organisations psp
          ON psp.id = om.organisation_id
        JOIN users u ON u.id = om.user_id
        WHERE cr.id = $1
          AND om.user_id = $2
          AND om.role IN ('owner', 'admin', 'operator')
          AND psp.organisation_type = 'psp_operator'
          AND psp.is_active = TRUE
          AND u.is_active = TRUE
        FOR UPDATE OF cr
      `,
      [collectionRequestId, operatorUserId],
    );

    if (request.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "not_found" };
    }

    const collection = request.rows[0]!;

    if (collection.status !== "collected") {
      await client.query("ROLLBACK");
      return {
        outcome: "invalid_status",
        currentStatus: collection.status,
      };
    }

    const facility = await client.query<{ id: string }>(
      `
        SELECT cf.id
        FROM collection_facilities cf
        JOIN organisations o ON o.id = cf.organisation_id
        WHERE cf.id = $1
          AND cf.is_approved = TRUE
          AND o.is_active = TRUE
          AND o.organisation_type = 'recycling_facility'
          AND LOWER(TRIM(cf.service_area)) =
              LOWER(TRIM($2))
        FOR SHARE OF cf
      `,
      [input.facilityId, collection.serviceArea],
    );

    if (facility.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "invalid_facility" };
    }

    const handover = await client.query<{
      id: string;
      collectionRequestId: string;
      facilityId: string;
      wasteCategory: string;
      quantity: string;
      quantityUnit: string;
      receivedAt: Date;
    }>(
      `
        INSERT INTO waste_handover_records (
          collection_request_id,
          facility_id,
          recorded_by_user_id,
          waste_category,
          quantity,
          quantity_unit,
          evidence_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          collection_request_id AS "collectionRequestId",
          facility_id AS "facilityId",
          waste_category AS "wasteCategory",
          quantity::text AS quantity,
          quantity_unit AS "quantityUnit",
          received_at AS "receivedAt"
      `,
      [
        collectionRequestId,
        input.facilityId,
        operatorUserId,
        input.wasteCategory,
        input.quantity,
        input.quantityUnit,
        input.evidenceHash ?? null,
      ],
    );

    await client.query(
      `
        INSERT INTO collection_events (
          collection_request_id,
          actor_user_id,
          event_type,
          notes,
          evidence_hash
        )
        VALUES ($1, $2, 'facility_handover', $3, $4)
      `,
      [
        collectionRequestId,
        operatorUserId,
        `Waste handover recorded at facility. Quantity: ${input.quantity} ${input.quantityUnit}.`,
        input.evidenceHash ?? null,
      ],
    );

    await client.query("COMMIT");

    return {
      outcome: "created",
      ...handover.rows[0]!,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type VerifyCollectionOutcome =
  | {
      outcome: "verified";
      id: string;
      status: string;
      handoverId: string;
      facilityId: string;
      verifiedAt: Date;
      blockchainStatus: "confirmed" | "failed";
      blockchainTransactionHash: string | null;
    }
  | { outcome: "not_authorised" }
  | { outcome: "not_found" }
  | { outcome: "invalid_status"; currentStatus: string }
  | { outcome: "missing_handover" };

export async function verifyCollectionRequest(
  oversightUserId: string,
  collectionRequestId: string,
): Promise<VerifyCollectionOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oversight = await client.query<{ organisationId: string }>(
      `
        SELECT o.id AS "organisationId"
        FROM organisation_members om
        JOIN organisations o ON o.id = om.organisation_id
        JOIN users u ON u.id = om.user_id
        WHERE om.user_id = $1
          AND om.role IN ('owner', 'admin')
          AND o.organisation_type = 'lawma_authority'
          AND o.is_active = TRUE
          AND u.is_active = TRUE
        LIMIT 1
      `,
      [oversightUserId],
    );

    if (oversight.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "not_authorised" };
    }

    const request = await client.query<{
      id: string;
      serviceArea: string;
      status: string;
    }>(
      `
        SELECT
          id,
          service_area AS "serviceArea",
          status
        FROM collection_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [collectionRequestId],
    );

    if (request.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "not_found" };
    }

    const collection = request.rows[0]!;

    if (collection.status !== "collected") {
      await client.query("ROLLBACK");
      return {
        outcome: "invalid_status",
        currentStatus: collection.status,
      };
    }

    const handover = await client.query<{
      handoverId: string;
      facilityId: string;
      facilityCode: string;
      wasteCategory: string;
      quantity: string;
      quantityUnit: string;
      evidenceHash: string | null;
    }>(
      `
        SELECT
          wh.id AS "handoverId",
          cf.id AS "facilityId",
          cf.facility_code AS "facilityCode",
          wh.waste_category AS "wasteCategory",
          wh.quantity::text AS quantity,
          wh.quantity_unit AS "quantityUnit",
          wh.evidence_hash AS "evidenceHash"
        FROM waste_handover_records wh
        JOIN collection_facilities cf ON cf.id = wh.facility_id
        JOIN organisations o ON o.id = cf.organisation_id
        WHERE wh.collection_request_id = $1
          AND cf.is_approved = TRUE
          AND o.is_active = TRUE
          AND o.organisation_type = 'recycling_facility'
          AND LOWER(TRIM(cf.service_area)) =
              LOWER(TRIM($2))
        ORDER BY wh.received_at DESC
        LIMIT 1
      `,
      [collectionRequestId, collection.serviceArea],
    );

    if (handover.rowCount === 0) {
      await client.query("ROLLBACK");
      return { outcome: "missing_handover" };
    }

    const receipt = handover.rows[0]!;

    const updated = await client.query<{ id: string; status: string }>(
      `
        UPDATE collection_requests
        SET status = 'verified'
        WHERE id = $1
          AND status = 'collected'
        RETURNING id, status
      `,
      [collectionRequestId],
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return {
        outcome: "invalid_status",
        currentStatus: collection.status,
      };
    }

    const event = await client.query<{ verifiedAt: Date }>(
      `
        INSERT INTO collection_events (
          collection_request_id,
          actor_user_id,
          event_type,
          notes,
          evidence_hash
        )
        VALUES ($1, $2, 'collection_verified', $3, $4)
        RETURNING created_at AS "verifiedAt"
      `,
      [
        collectionRequestId,
        oversightUserId,
        `Collection verified by oversight. Facility: ${receipt.facilityCode}. Handover: ${receipt.handoverId}.`,
        receipt.evidenceHash,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_logs (
          actor_user_id,
          actor_organisation_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        VALUES ($1, $2, 'collection_verified', 'collection_request', $3, $4::jsonb)
      `,
      [
        oversightUserId,
        oversight.rows[0]!.organisationId,
        collectionRequestId,
        JSON.stringify({
          handoverId: receipt.handoverId,
          facilityId: receipt.facilityId,
          facilityCode: receipt.facilityCode,
          wasteCategory: receipt.wasteCategory,
          quantity: receipt.quantity,
          quantityUnit: receipt.quantityUnit,
        }),
      ],
    );

    await client.query("COMMIT");

    const evidenceHash = receipt.evidenceHash
      ? (receipt.evidenceHash.startsWith("0x")
          ? receipt.evidenceHash
          : `0x${receipt.evidenceHash}`)
      : `0x${createHash("sha256")
          .update(JSON.stringify({
            collectionRequestId,
            handoverId: receipt.handoverId,
            facilityId: receipt.facilityId,
            facilityCode: receipt.facilityCode,
            wasteCategory: receipt.wasteCategory,
            quantity: receipt.quantity,
            quantityUnit: receipt.quantityUnit,
          }))
          .digest("hex")}`;

    const collectionReference = id(collectionRequestId);
    let blockchainStatus: "confirmed" | "failed" = "failed";
    let blockchainTransactionHash: string | null = null;

    try {
      await pool.query(
        `
          INSERT INTO collection_blockchain_proofs (
            collection_request_id,
            chain_id,
            contract_address,
            collection_reference,
            evidence_hash,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'pending')
        `,
        [
          collectionRequestId,
          env.BLOCKCHAIN_CHAIN_ID,
          env.BLOCKCHAIN_CONTRACT_ADDRESS,
          collectionReference,
          evidenceHash,
        ],
      );

      const proof = await recordCollectionProof(
        collectionRequestId,
        evidenceHash,
      );

      blockchainStatus = "confirmed";
      blockchainTransactionHash = proof.transactionHash;

      await pool.query(
        `
          UPDATE collection_blockchain_proofs
          SET status = 'confirmed',
              transaction_hash = $2,
              confirmed_at = NOW()
          WHERE collection_request_id = $1
        `,
        [collectionRequestId, proof.transactionHash],
      );
    } catch (blockchainError) {
      console.error("Blockchain proof submission failed:", blockchainError);

      try {
        await pool.query(
          `
            UPDATE collection_blockchain_proofs
            SET status = 'failed'
            WHERE collection_request_id = $1
              AND status = 'pending'
          `,
          [collectionRequestId],
        );
      } catch (trackingError) {
        console.error("Could not update blockchain proof status:", trackingError);
      }
    }

    return {
      outcome: "verified",
      id: updated.rows[0]!.id,
      status: updated.rows[0]!.status,
      handoverId: receipt.handoverId,
      facilityId: receipt.facilityId,
      verifiedAt: event.rows[0]!.verifiedAt,
      blockchainStatus,
      blockchainTransactionHash,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecyclerIncomingHandovers(userId: string) {
  const result = await pool.query(
    `
      SELECT
        wh.id AS "handoverId",
        wh.collection_request_id AS "collectionRequestId",
        cf.facility_code AS "facilityCode",
        cf.facility_address AS "facilityAddress",
        cf.service_area AS "serviceArea",
        wh.waste_category AS "wasteCategory",
        wh.quantity,
        wh.quantity_unit AS "quantityUnit",
        wh.evidence_hash AS "evidenceHash",
        wh.received_at AS "receivedAt",
        psp.name AS "pspOrganisationName"
      FROM waste_handover_records wh
      JOIN collection_facilities cf
        ON cf.id = wh.facility_id
      JOIN organisations recycler
        ON recycler.id = cf.organisation_id
      JOIN organisation_members om
        ON om.organisation_id = recycler.id
      JOIN users u
        ON u.id = om.user_id
      JOIN collection_requests cr
        ON cr.id = wh.collection_request_id
      LEFT JOIN organisations psp
        ON psp.id = cr.assigned_psp_organisation_id
      WHERE om.user_id = $1
        AND om.role IN ('owner', 'admin', 'operator')
        AND u.is_active = TRUE
        AND recycler.is_active = TRUE
        AND recycler.organisation_type = 'recycling_facility'
        AND cf.is_approved = TRUE
      ORDER BY wh.received_at DESC
      LIMIT 100
    `,
    [userId],
  );

  return result.rows;
}


export async function getPspHandoverFacilities(
  operatorUserId: string,
  collectionRequestId: string,
) {
  const collection = await pool.query<{ serviceArea: string }>(
    `
      SELECT cr.service_area AS "serviceArea"
      FROM collection_requests cr
      JOIN organisation_members om
        ON om.organisation_id = cr.assigned_psp_organisation_id
      JOIN organisations psp
        ON psp.id = om.organisation_id
      JOIN users u ON u.id = om.user_id
      WHERE cr.id = $1
        AND om.user_id = $2
        AND om.role IN ('owner', 'admin', 'operator')
        AND psp.organisation_type = 'psp_operator'
        AND psp.is_active = TRUE
        AND u.is_active = TRUE
        AND cr.status = 'collected'
      LIMIT 1
    `,
    [collectionRequestId, operatorUserId],
  );

  if (collection.rowCount === 0) {
    return null;
  }

  const facilities = await pool.query<{
    id: string;
    name: string;
    facilityCode: string;
    facilityAddress: string;
    serviceArea: string;
  }>(
    `
      SELECT
        cf.id,
        o.name,
        cf.facility_code AS "facilityCode",
        cf.facility_address AS "facilityAddress",
        cf.service_area AS "serviceArea"
      FROM collection_facilities cf
      JOIN organisations o ON o.id = cf.organisation_id
      WHERE cf.is_approved = TRUE
        AND o.is_active = TRUE
        AND o.organisation_type = 'recycling_facility'
        AND LOWER(TRIM(cf.service_area)) =
            LOWER(TRIM($1))
      ORDER BY o.name ASC
    `,
    [collection.rows[0]!.serviceArea],
  );

  return facilities.rows;
}
