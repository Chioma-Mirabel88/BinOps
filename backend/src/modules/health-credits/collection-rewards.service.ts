import type { PoolClient } from "pg";

type RewardActor = {
  userId: string;
  organisationId: string;
};

export async function processPendingCollectionRewards(
  client: PoolClient,
  actor: RewardActor,
): Promise<number> {
  // Serialize automatic reward allocation across collection and funding workflows.
  await client.query(
    "SELECT pg_advisory_xact_lock(731942, 20261112)",
  );

  const fundingResult = await client.query<{
    id: string;
    amountFunded: string;
    issued: string;
  }>(
    `
      SELECT
        f.id,
        f.amount_funded::text AS "amountFunded",
        COALESCE((
          SELECT SUM(t.credit_delta)
          FROM health_credit_transactions t
          WHERE t.funding_id = f.id
            AND t.transaction_type = 'issuance'
        ), 0)::text AS issued
      FROM health_credit_funding f
      WHERE f.status = 'confirmed'
        AND f.currency = 'BHC'
      ORDER BY f.created_at, f.id
      FOR UPDATE
    `,
  );

  const funds = fundingResult.rows.map((row) => ({
    id: row.id,
    available: Number(row.amountFunded) - Number(row.issued),
  }));

  const pendingResult = await client.query<{
    id: string;
    accountId: string;
    rewardAmount: string;
    weightKg: string;
    accountStatus: string;
  }>(
    `
      SELECT
        r.id,
        r.account_id AS "accountId",
        r.reward_amount::text AS "rewardAmount",
        r.weight_kg::text AS "weightKg",
        a.status AS "accountStatus"
      FROM health_credit_pending_rewards r
      JOIN health_credit_accounts a ON a.id = r.account_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at, r.id
      FOR UPDATE OF r
    `,
  );

  let issuedCount = 0;

  for (const reward of pendingResult.rows) {
    if (reward.accountStatus !== "active") continue;

    const amount = Number(reward.rewardAmount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const funding = funds.find((item) => item.available >= amount);
    if (!funding) continue;

    const idempotencyKey =
      `collection:${reward.id}:health-credit-reward`;

    const transaction = await client.query<{ id: string }>(
      `
        INSERT INTO health_credit_transactions (
          account_id,
          funding_id,
          transaction_type,
          credit_delta,
          idempotency_key,
          description,
          created_by_user_id
        )
        SELECT $1, $2, 'issuance', $3, $4, $5, $6
        WHERE NOT EXISTS (
          SELECT 1
          FROM health_credit_transactions
          WHERE idempotency_key = $4
        )
        RETURNING id
      `,
      [
        reward.accountId,
        funding.id,
        amount.toFixed(2),
        idempotencyKey,
        `Automatic collection reward: ${reward.weightKg} KG at 5 BHC per KG.`,
        actor.userId,
      ],
    );

    if (!transaction.rowCount) {
      throw new Error(
        `Reward idempotency conflict for pending reward ${reward.id}.`,
      );
    }

    const transactionId = transaction.rows[0]!.id;

    await client.query(
      `
        UPDATE health_credit_pending_rewards
        SET
          status = 'issued',
          funding_id = $2,
          health_credit_transaction_id = $3,
          issued_at = NOW()
        WHERE id = $1
          AND status = 'pending'
      `,
      [reward.id, funding.id, transactionId],
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
        VALUES ($1, $2, 'health_credits_issued',
                'health_credit_transaction', $3, $4::jsonb)
      `,
      [
        actor.userId,
        actor.organisationId,
        transactionId,
        JSON.stringify({
          pendingRewardId: reward.id,
          accountId: reward.accountId,
          collectionReward: true,
          weightKg: reward.weightKg,
          rateBhcPerKg: 5,
          amountBhc: amount.toFixed(2),
          currency: "BHC",
          fundingId: funding.id,
        }),
      ],
    );

    funding.available -= amount;

    if (funding.available <= 0) {
      await client.query(
        `
          UPDATE health_credit_funding
          SET status = 'exhausted'
          WHERE id = $1
            AND status = 'confirmed'
        `,
        [funding.id],
      );
    }

    issuedCount += 1;
  }

  return issuedCount;
}
