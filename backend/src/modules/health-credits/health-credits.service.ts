import { pool } from "../../config/database.js";
import type { PoolClient } from "pg";
import { processPendingCollectionRewards } from "./collection-rewards.service.js";

export interface FundingInput {
  sourceType:
    | "subscription_allocation"
    | "sponsorship"
    | "csr"
    | "grant"
    | "provider_contribution"
    | "other";
  sourceReference?: string | undefined;
  amountFunded: number;
}

export interface IssuanceInput {
  accountId: string;
  fundingId: string;
  amount: number;
  idempotencyKey: string;
  description?: string | undefined;
}

export type FundingOutcome =
  | { outcome: "created"; id: string }
  | { outcome: "duplicate_reference" };

export type IssuanceOutcome =
  | { outcome: "issued"; transactionId: string; accountId: string; amount: string }
  | { outcome: "duplicate" }
  | { outcome: "account_not_found" }
  | { outcome: "account_inactive" }
  | { outcome: "funding_not_found" }
  | { outcome: "funding_not_confirmed" }
  | { outcome: "insufficient_funding"; available: string };

async function rollback(client: PoolClient) {
  await client.query("ROLLBACK");
}

async function getBinOpsAdminOrganisationId(client: PoolClient, userId: string): Promise<string | null> {
  const result = await client.query<{ organisationId: string }>(
    `SELECT o.id AS "organisationId"
     FROM organisation_members om
     JOIN organisations o ON o.id = om.organisation_id
     JOIN users u ON u.id = om.user_id
     WHERE om.user_id = $1
       AND om.role IN ('owner', 'admin')
       AND o.organisation_type = 'binops'
       AND o.is_active = TRUE AND u.is_active = TRUE
     LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.organisationId ?? null;
}

export async function createHealthCreditFunding(
  userId: string,
  input: FundingInput,
): Promise<FundingOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const organisationId = await getBinOpsAdminOrganisationId(client, userId);
    if (!organisationId) {
      await rollback(client);
      throw new Error("BinOps authorisation required.");
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO health_credit_funding
        (source_type, source_reference, amount_funded, created_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        input.sourceType,
        input.sourceReference ?? null,
        input.amountFunded,
        userId,
      ],
    );

    const fundingId = result.rows[0]!.id;

    await client.query(
      `INSERT INTO audit_logs
        (actor_user_id, actor_organisation_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        organisationId,
        "health_credit_funding_created",
        "health_credit_funding",
        fundingId,
        JSON.stringify({
          sourceType: input.sourceType,
          amountFunded: input.amountFunded,
          status: "pending",
        }),
      ],
    );

    await client.query("COMMIT");
    return { outcome: "created", id: fundingId };
  } catch (error) {
    await rollback(client);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { outcome: "duplicate_reference" };
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function confirmHealthCreditFunding(
  userId: string,
  fundingId: string,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const organisationId = await getBinOpsAdminOrganisationId(client, userId);

    if (!organisationId) {
      await rollback(client);
      return { outcome: "not_authorised" as const };
    }

    // Acquire the same lock before locking funding rows in either workflow.
    await client.query(
      "SELECT pg_advisory_xact_lock(731942, 20261112)",
    );

    const funding = await client.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM health_credit_funding
       WHERE id = $1
       FOR UPDATE`,
      [fundingId],
    );

    if (!funding.rowCount) {
      await rollback(client);
      return { outcome: "not_found" as const };
    }

    if (funding.rows[0]!.status !== "pending") {
      await rollback(client);
      return { outcome: "not_pending" as const };
    }

    await client.query(
      `UPDATE health_credit_funding
       SET status = 'confirmed', confirmed_at = NOW()
       WHERE id = $1`,
      [fundingId],
    );

    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, actor_organisation_id, action,
        entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        organisationId,
        "health_credit_funding_confirmed",
        "health_credit_funding",
        fundingId,
        JSON.stringify({ status: "confirmed", currency: "BHC" }),
      ],
    );

    const pendingRewardsIssued = await processPendingCollectionRewards(
      client,
      { userId, organisationId },
    );

    await client.query("COMMIT");
    return {
      outcome: "confirmed" as const,
      id: fundingId,
      pendingRewardsIssued,
    };
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function issueHealthCredits(
  userId: string,
  input: IssuanceInput,
): Promise<IssuanceOutcome> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const organisationId = await getBinOpsAdminOrganisationId(client, userId);

    if (!organisationId) {
      await rollback(client);
      throw new Error("BinOps authorisation required.");
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Issuance amount must be positive.");
    }

    const duplicate = await client.query(
      `SELECT id FROM health_credit_transactions
       WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );

    if (duplicate.rowCount) {
      await rollback(client);
      return { outcome: "duplicate" };
    }

    const account = await client.query<{ status: string }>(
      `SELECT status FROM health_credit_accounts
       WHERE id = $1 FOR UPDATE`,
      [input.accountId],
    );

    if (!account.rowCount) {
      await rollback(client);
      return { outcome: "account_not_found" };
    }

    if (account.rows[0]!.status !== "active") {
      await rollback(client);
      return { outcome: "account_inactive" };
    }

    const funding = await client.query<{
      amountFunded: string;
      status: string;
    }>(
      `SELECT amount_funded AS "amountFunded", status
       FROM health_credit_funding
       WHERE id = $1 FOR UPDATE`,
      [input.fundingId],
    );

    if (!funding.rowCount) {
      await rollback(client);
      return { outcome: "funding_not_found" };
    }

    if (funding.rows[0]!.status !== "confirmed") {
      await rollback(client);
      return { outcome: "funding_not_confirmed" };
    }

    const usage = await client.query<{ issued: string }>(
      `SELECT COALESCE(SUM(credit_delta), 0)::numeric(14,2) AS issued
       FROM health_credit_transactions
       WHERE funding_id = $1
         AND transaction_type = 'issuance'`,
      [input.fundingId],
    );

    const available = Number(funding.rows[0]!.amountFunded)
      - Number(usage.rows[0]!.issued);

    if (input.amount > available) {
      await rollback(client);
      return {
        outcome: "insufficient_funding",
        available: available.toFixed(2),
      };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO health_credit_transactions
       (account_id, funding_id, transaction_type, credit_delta,
        idempotency_key, description, created_by_user_id)
       VALUES ($1, $2, 'issuance', $3, $4, $5, $6)
       RETURNING id`,
      [
        input.accountId,
        input.fundingId,
        input.amount.toFixed(2),
        input.idempotencyKey,
        input.description ?? "Health Credits issuance",
        userId,
      ],
    );

    const transactionId = inserted.rows[0]!.id;

    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, actor_organisation_id, action,
        entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        organisationId,
        "health_credits_issued",
        "health_credit_transaction",
        transactionId,
        JSON.stringify({
          accountId: input.accountId,
          fundingId: input.fundingId,
          amount: input.amount,
        }),
      ],
    );

    if (input.amount >= available) {
      await client.query(
        `UPDATE health_credit_funding
         SET status = 'exhausted'
         WHERE id = $1`,
        [input.fundingId],
      );
    }

    await client.query("COMMIT");

    return {
      outcome: "issued",
      transactionId,
      accountId: input.accountId,
      amount: input.amount.toFixed(2),
    };
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function getHealthCreditBalance(userId: string) {
  await pool.query(
    `INSERT INTO health_credit_accounts (owner_user_id)
     VALUES ($1)
     ON CONFLICT (owner_user_id) DO NOTHING`,
    [userId],
  );

  const result = await pool.query<{
    accountId: string;
    status: string;
    availableCredits: string;
  }>(
    `SELECT account_id AS "accountId",
            status,
            available_credits AS "availableCredits"
     FROM health_credit_account_balances
     WHERE owner_user_id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export interface RedemptionInput {
  accountId: string;
  amount: number;
  idempotencyKey: string;
  description?: string | undefined;
}

export async function redeemHealthCredits(
  userId: string,
  input: RedemptionInput,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const partner = await client.query<{ organisationId: string }>(
      `SELECT o.id AS "organisationId"
       FROM organisation_members om
       JOIN organisations o ON o.id = om.organisation_id
       JOIN users u ON u.id = om.user_id
       WHERE om.user_id = $1
         AND om.role IN ('owner', 'admin', 'staff')
         AND o.organisation_type IN ('hospital', 'pharmacy')
         AND o.is_active = TRUE
         AND u.is_active = TRUE
       LIMIT 1`,
      [userId],
    );

    if (!partner.rowCount) {
      await rollback(client);
      return { outcome: "not_authorised" as const };
    }

    const duplicate = await client.query(
      `SELECT id FROM health_credit_transactions
       WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );

    if (duplicate.rowCount) {
      await rollback(client);
      return { outcome: "duplicate" as const };
    }

    const account = await client.query<{ status: string }>(
      `SELECT status FROM health_credit_accounts
       WHERE id = $1 FOR UPDATE`,
      [input.accountId],
    );

    if (!account.rowCount) {
      await rollback(client);
      return { outcome: "account_not_found" as const };
    }

    if (account.rows[0]!.status !== "active") {
      await rollback(client);
      return { outcome: "account_inactive" as const };
    }

    const balance = await client.query<{ sufficient: boolean; available: string }>(
      `SELECT available_credits AS available,
              available_credits >= $2::numeric AS sufficient
       FROM health_credit_account_balances
       WHERE account_id = $1`,
      [input.accountId, input.amount.toFixed(2)],
    );

    if (!balance.rows[0]?.sufficient) {
      await rollback(client);
      return {
        outcome: "insufficient_balance" as const,
        available: balance.rows[0]?.available ?? "0.00",
      };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO health_credit_transactions
       (account_id, transaction_type, credit_delta,
        healthcare_partner_organisation_id, redemption_value_ngn,
        idempotency_key, description, created_by_user_id)
       VALUES ($1, 'redemption', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.accountId,
        (-input.amount).toFixed(2),
        partner.rows[0]!.organisationId,
        input.amount.toFixed(2),
        input.idempotencyKey,
        input.description ?? "Healthcare partner redemption",
        userId,
      ],
    );

    const transactionId = inserted.rows[0]!.id;

    await client.query(
      `INSERT INTO audit_logs
       (actor_user_id, actor_organisation_id, action,
        entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        partner.rows[0]!.organisationId,
        "health_credits_redeemed",
        "health_credit_transaction",
        transactionId,
        JSON.stringify({
          accountId: input.accountId,
          amount: input.amount,
        }),
      ],
    );

    await client.query("COMMIT");

    return {
      outcome: "redeemed" as const,
      transactionId,
      accountId: input.accountId,
      amount: input.amount.toFixed(2),
    };
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}


export async function getHealthCreditManagementData() {
  const [funding, transactions] = await Promise.all([
    pool.query(
      `SELECT id, source_type AS "sourceType",
              source_reference AS "sourceReference",
              amount_funded AS "amountFunded",
              currency, status, created_at AS "createdAt",
              confirmed_at AS "confirmedAt"
       FROM health_credit_funding
       ORDER BY created_at DESC
       LIMIT 100`
    ),
    pool.query(
      `SELECT t.id, t.account_id AS "accountId",
              t.funding_id AS "fundingId",
              t.transaction_type AS "transactionType",
              t.credit_delta AS "creditDelta",
              t.description,
              t.created_at AS "createdAt"
       FROM health_credit_transactions t
       ORDER BY t.created_at DESC
       LIMIT 100`
    )
  ]);

  return { funding: funding.rows, transactions: transactions.rows };
}


export async function getHealthcareDirectory() {
  const result = await pool.query<{
    id: string;
    name: string;
    organisationType: "hospital" | "pharmacy";
    serviceArea: string | null;
    contactPhone: string | null;
  }>(
    `SELECT
       id,
       name,
       organisation_type AS "organisationType",
       service_area AS "serviceArea",
       contact_phone AS "contactPhone"
     FROM organisations
     WHERE is_active = TRUE
       AND organisation_type IN ('hospital', 'pharmacy')
     ORDER BY name ASC`
  );

  return result.rows;
}
