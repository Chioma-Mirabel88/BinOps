BEGIN;

-- Account and organisation types
CREATE TYPE organisation_type AS ENUM (
    'business',
    'psp_operator',
    'hospital',
    'pharmacy',
    'recycling_facility',
    'regulator',
    'lawma_authority'
);

CREATE TYPE membership_role AS ENUM (
    'owner',
    'admin',
    'staff',
    'operator'
);

CREATE TYPE customer_type AS ENUM (
    'individual',
    'business',
    'healthcare_partner'
);

CREATE TYPE billing_interval AS ENUM (
    'one_time',
    'monthly',
    'quarterly',
    'annually'
);

CREATE TYPE subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);

CREATE TYPE payment_purpose AS ENUM (
    'subscription',
    'collection_service',
    'healthcare_platform_fee'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'successful',
    'failed',
    'refunded'
);

CREATE TYPE settlement_status AS ENUM (
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled'
);

CREATE TYPE reconciliation_status AS ENUM (
    'pending',
    'matched',
    'mismatch'
);


CREATE TYPE health_credit_funding_source AS ENUM (
    'subscription_allocation', 'sponsorship', 'csr',
    'grant', 'provider_contribution', 'other'
);

CREATE TYPE health_credit_funding_status AS ENUM (
    'pending', 'confirmed', 'exhausted', 'cancelled'
);

CREATE TYPE health_credit_account_status AS ENUM (
    'active', 'suspended', 'closed'
);

CREATE TYPE health_credit_transaction_type AS ENUM (
    'issuance', 'redemption', 'reversal', 'adjustment'
);

CREATE TYPE healthcare_settlement_status AS ENUM (
    'pending', 'processing', 'paid', 'failed', 'cancelled'
);

CREATE TYPE waste_quantity_unit AS ENUM (
    'kg', 'tonne', 'litre', 'bag'
);

CREATE TYPE allocation_type AS ENUM (
    'platform_commission',
    'psp_operator',
    'processing_fee'
);

CREATE TYPE collection_status AS ENUM (
    'requested',
    'assigned',
    'scheduled',
    'in_progress',
    'collected',
    'verified',
    'cancelled'
);

CREATE TYPE collection_event_type AS ENUM (
    'request_created',
    'operator_assigned',
    'collection_scheduled',
    'collection_started',
    'waste_collected',
    'facility_handover',
    'collection_verified',
    'collection_cancelled'
);

CREATE TYPE notification_type AS ENUM (
    'collection_reminder',
    'bin_full',
    'operator_assigned',
    'collection_update',
    'collection_completed',
    'payment_confirmation',
    'subscription_reminder',
    'service_announcement'
);

CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'cancelled'
);

-- 1. Application users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Businesses, PSP operators and institutional partners
CREATE TABLE organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    organisation_type organisation_type NOT NULL,
    registration_number VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    service_area TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users belonging to organisations
CREATE TABLE organisation_members (
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role membership_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organisation_id, user_id)
);

-- 4. Customer and healthcare partner plans
CREATE TABLE service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    customer_type customer_type NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN',
    billing_interval billing_interval NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Customer and partner subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES service_plans(id),
    subscriber_user_id UUID REFERENCES users(id),
    subscriber_organisation_id UUID REFERENCES organisations(id),
    status subscription_status NOT NULL DEFAULT 'pending',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (subscriber_user_id IS NOT NULL AND subscriber_organisation_id IS NULL)
        OR
        (subscriber_user_id IS NULL AND subscriber_organisation_id IS NOT NULL)
    )
);

-- 6. Customer and partner payment records
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_user_id UUID REFERENCES users(id),
    payer_organisation_id UUID REFERENCES organisations(id),
    subscription_id UUID REFERENCES subscriptions(id),
    purpose payment_purpose NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN',
    status payment_status NOT NULL DEFAULT 'pending',
    gateway_provider VARCHAR(100),
    gateway_reference VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (payer_user_id IS NOT NULL AND payer_organisation_id IS NULL)
        OR
        (payer_user_id IS NULL AND payer_organisation_id IS NOT NULL)
    ),
    UNIQUE (gateway_provider, gateway_reference)
);

-- 7. Payment allocations for BinOps and PSP operators
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    allocation_type allocation_type NOT NULL,
    beneficiary_organisation_id UUID REFERENCES organisations(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (allocation_type = 'psp_operator' AND beneficiary_organisation_id IS NOT NULL)
        OR
        (allocation_type <> 'psp_operator' AND beneficiary_organisation_id IS NULL)
    ),
    UNIQUE (id, beneficiary_organisation_id)
);

-- 8. PSP operator settlements
CREATE TABLE psp_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_allocation_id UUID NOT NULL,
    psp_organisation_id UUID NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN',
    status settlement_status NOT NULL DEFAULT 'pending',
    settlement_reference VARCHAR(255) UNIQUE,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (payment_allocation_id, psp_organisation_id)
        REFERENCES payment_allocations(id, beneficiary_organisation_id),
    CHECK (status <> 'paid' OR settled_at IS NOT NULL)
);

-- 9. Payment reconciliation records
CREATE TABLE payment_reconciliations (
    payment_id UUID PRIMARY KEY REFERENCES payments(id),
    gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount >= 0),
    variance_amount NUMERIC(12,2)
        GENERATED ALWAYS AS (gross_amount - allocated_amount) STORED,
    status reconciliation_status NOT NULL DEFAULT 'pending',
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status <> 'matched' OR gross_amount = allocated_amount)
);

-- 10. Waste collection requests
CREATE TABLE collection_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID REFERENCES users(id),
    customer_organisation_id UUID REFERENCES organisations(id),
    assigned_psp_organisation_id UUID REFERENCES organisations(id),
    service_address_ciphertext BYTEA NOT NULL,
    service_address_key_version VARCHAR(50) NOT NULL,
    service_area VARCHAR(150) NOT NULL,
    waste_category VARCHAR(100),
    bin_fullness VARCHAR(30) NOT NULL DEFAULT 'full',
    status collection_status NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (customer_user_id IS NOT NULL AND customer_organisation_id IS NULL)
        OR
        (customer_user_id IS NULL AND customer_organisation_id IS NOT NULL)
    )
);

-- 9. Collection history and operational evidence
CREATE TABLE collection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_request_id UUID NOT NULL REFERENCES collection_requests(id),
    actor_user_id UUID REFERENCES users(id),
    event_type collection_event_type NOT NULL,
    notes TEXT,
    evidence_hash CHAR(64),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. In-app notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    collection_request_id UUID REFERENCES collection_requests(id),
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status notification_status NOT NULL DEFAULT 'pending',
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service addresses must be encrypted by the application before storage.
COMMENT ON COLUMN collection_requests.service_address_ciphertext IS
    'Application-encrypted service address. Never store plaintext or publish this value on-chain.';

COMMENT ON COLUMN collection_requests.service_address_key_version IS
    'Identifier for the application-managed encryption key version. Never store key material here.';


-- Health Credit funding records
CREATE TABLE health_credit_funding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type health_credit_funding_source NOT NULL,
    source_reference VARCHAR(255),
    amount_funded NUMERIC(14,2) NOT NULL CHECK (amount_funded > 0),
    currency CHAR(3) NOT NULL DEFAULT 'NGN',
    status health_credit_funding_status NOT NULL DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_type, source_reference),
    CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL)
);

-- Health Credit accounts: one account per eligible user or organisation
CREATE TABLE health_credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES users(id),
    owner_organisation_id UUID REFERENCES organisations(id),
    status health_credit_account_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (owner_user_id IS NOT NULL AND owner_organisation_id IS NULL)
        OR
        (owner_user_id IS NULL AND owner_organisation_id IS NOT NULL)
    ),
    UNIQUE (owner_user_id),
    UNIQUE (owner_organisation_id)
);

-- Append-only Health Credit transaction ledger
CREATE TABLE health_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES health_credit_accounts(id),
    funding_id UUID REFERENCES health_credit_funding(id),
    transaction_type health_credit_transaction_type NOT NULL,
    credit_delta NUMERIC(14,2) NOT NULL CHECK (credit_delta <> 0),
    healthcare_partner_organisation_id UUID REFERENCES organisations(id),
    redemption_value_ngn NUMERIC(14,2),
    related_transaction_id UUID REFERENCES health_credit_transactions(id),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (transaction_type = 'issuance'
            AND credit_delta > 0
            AND funding_id IS NOT NULL
            AND healthcare_partner_organisation_id IS NULL
            AND redemption_value_ngn IS NULL)
        OR
        (transaction_type = 'redemption'
            AND credit_delta < 0
            AND funding_id IS NULL
            AND healthcare_partner_organisation_id IS NOT NULL
            AND redemption_value_ngn > 0)
        OR
        (transaction_type = 'reversal'
            AND related_transaction_id IS NOT NULL)
        OR
        (transaction_type = 'adjustment'
            AND funding_id IS NULL
            AND redemption_value_ngn IS NULL)
    )
);

-- Derived balances: the ledger remains the source of truth
CREATE VIEW health_credit_account_balances AS
SELECT
    a.id AS account_id,
    a.owner_user_id,
    a.owner_organisation_id,
    a.status,
    COALESCE(SUM(t.credit_delta), 0)::NUMERIC(14,2) AS available_credits
FROM health_credit_accounts a
LEFT JOIN health_credit_transactions t ON t.account_id = a.id
GROUP BY a.id, a.owner_user_id, a.owner_organisation_id, a.status;

-- Healthcare partner settlements
CREATE TABLE healthcare_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    healthcare_partner_organisation_id UUID NOT NULL REFERENCES organisations(id),
    amount_ngn NUMERIC(14,2) NOT NULL CHECK (amount_ngn > 0),
    status healthcare_settlement_status NOT NULL DEFAULT 'pending',
    settlement_reference VARCHAR(255) UNIQUE,
    period_start DATE,
    period_end DATE,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        period_start IS NULL OR period_end IS NULL
        OR period_end >= period_start
    ),
    CHECK (status <> 'paid' OR settled_at IS NOT NULL)
);

-- Each redemption can be included in only one partner settlement
CREATE TABLE healthcare_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES healthcare_settlements(id),
    health_credit_transaction_id UUID NOT NULL UNIQUE
        REFERENCES health_credit_transactions(id),
    amount_ngn NUMERIC(14,2) NOT NULL CHECK (amount_ngn > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waste receiving facilities
CREATE TABLE collection_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL UNIQUE REFERENCES organisations(id),
    facility_code VARCHAR(100) NOT NULL UNIQUE,
    facility_address TEXT NOT NULL,
    service_area VARCHAR(150) NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evidence of waste received at a facility
CREATE TABLE waste_handover_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_request_id UUID NOT NULL REFERENCES collection_requests(id),
    facility_id UUID NOT NULL REFERENCES collection_facilities(id),
    recorded_by_user_id UUID REFERENCES users(id),
    waste_category VARCHAR(100) NOT NULL,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    quantity_unit waste_quantity_unit NOT NULL DEFAULT 'kg',
    evidence_hash CHAR(64),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform audit trail: do not store passwords, secrets or unnecessary PII
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id),
    actor_organisation_id UUID REFERENCES organisations(id),
    action VARCHAR(150) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE health_credit_transactions IS
    'Credit ledger. Enforce funding limits, balances and non-transferability in backend transactions.';

COMMENT ON VIEW health_credit_account_balances IS
    'Derived account balances; never manually update or store a separate balance.';

COMMENT ON TABLE audit_logs IS
    'Audit history. Application must exclude passwords, credentials and unnecessary personal data.';

-- Indexes for frequently accessed records

CREATE INDEX idx_health_credit_funding_status
    ON health_credit_funding(status);

CREATE INDEX idx_health_credit_transactions_account
    ON health_credit_transactions(account_id, created_at DESC);

CREATE INDEX idx_health_credit_transactions_funding
    ON health_credit_transactions(funding_id);

CREATE INDEX idx_health_credit_transactions_partner
    ON health_credit_transactions(healthcare_partner_organisation_id);

CREATE INDEX idx_healthcare_settlements_partner_status
    ON healthcare_settlements(healthcare_partner_organisation_id, status);

CREATE INDEX idx_healthcare_settlement_items_settlement
    ON healthcare_settlement_items(settlement_id);

CREATE INDEX idx_waste_handover_collection
    ON waste_handover_records(collection_request_id);

CREATE INDEX idx_waste_handover_facility
    ON waste_handover_records(facility_id, received_at DESC);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_logs_actor
    ON audit_logs(actor_user_id, created_at DESC);

CREATE INDEX idx_organisation_members_user
    ON organisation_members(user_id);

CREATE INDEX idx_subscriptions_user
    ON subscriptions(subscriber_user_id);

CREATE INDEX idx_subscriptions_organisation
    ON subscriptions(subscriber_organisation_id);

CREATE INDEX idx_payments_status
    ON payments(status);

CREATE INDEX idx_psp_settlements_operator_status
    ON psp_settlements(psp_organisation_id, status);

CREATE INDEX idx_psp_settlements_allocation
    ON psp_settlements(payment_allocation_id);

CREATE INDEX idx_payment_reconciliations_status
    ON payment_reconciliations(status);

CREATE INDEX idx_collection_requests_status
    ON collection_requests(status);

CREATE INDEX idx_collection_requests_psp
    ON collection_requests(assigned_psp_organisation_id);

CREATE INDEX idx_collection_requests_schedule
    ON collection_requests(scheduled_for);

CREATE INDEX idx_collection_events_request
    ON collection_events(collection_request_id);

CREATE INDEX idx_notifications_user_status
    ON notifications(user_id, status, created_at DESC);

CREATE INDEX idx_notifications_pending_schedule
    ON notifications(scheduled_for)
    WHERE status = 'pending' AND scheduled_for IS NOT NULL;

COMMIT;
