BEGIN;

-- Record the actual weight collected by the PSP.
ALTER TABLE collection_requests
  ADD COLUMN IF NOT EXISTS collected_weight_kg NUMERIC(14,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'collection_requests'::regclass
          AND conname = 'collection_requests_collected_weight_positive'
    ) THEN
        ALTER TABLE collection_requests
          ADD CONSTRAINT collection_requests_collected_weight_positive
          CHECK (collected_weight_kg IS NULL OR collected_weight_kg > 0);
    END IF;
END $$;

-- BHC has a 1:1 NGN value. Preserve existing numeric funding amounts.
ALTER TABLE health_credit_funding
  ALTER COLUMN currency SET DEFAULT 'BHC';

UPDATE health_credit_funding
SET currency = 'BHC'
WHERE currency = 'NGN';


-- Track individual collection rewards until confirmed BHC funding is available.
-- Pending rewards are separate from the append-only credit transaction ledger.
CREATE TABLE IF NOT EXISTS health_credit_pending_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_request_id UUID NOT NULL UNIQUE
        REFERENCES collection_requests(id),
    account_id UUID NOT NULL REFERENCES health_credit_accounts(id),
    weight_kg NUMERIC(14,2) NOT NULL CHECK (weight_kg > 0),
    reward_amount NUMERIC(14,2) NOT NULL CHECK (reward_amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'issued')),
    funding_id UUID REFERENCES health_credit_funding(id),
    health_credit_transaction_id UUID UNIQUE
        REFERENCES health_credit_transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_at TIMESTAMPTZ,
    CHECK (
        (status = 'pending'
            AND funding_id IS NULL
            AND health_credit_transaction_id IS NULL
            AND issued_at IS NULL)
        OR
        (status = 'issued'
            AND funding_id IS NOT NULL
            AND health_credit_transaction_id IS NOT NULL
            AND issued_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_health_credit_pending_rewards_status
    ON health_credit_pending_rewards(status, created_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_health_credit_pending_rewards_account
    ON health_credit_pending_rewards(account_id, created_at DESC);

COMMIT;
