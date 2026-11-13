CREATE TABLE collection_blockchain_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_request_id UUID NOT NULL UNIQUE
        REFERENCES collection_requests(id),
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    collection_reference VARCHAR(66) NOT NULL,
    evidence_hash VARCHAR(66) NOT NULL,
    transaction_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_collection_blockchain_proofs_status
    ON collection_blockchain_proofs(status);
