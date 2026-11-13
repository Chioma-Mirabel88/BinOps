-- BinOps comprehensive database smoke test
-- Target: binops_schema_check only
-- Uses synthetic records and rolls the entire test transaction back.
-- Run with:
-- docker compose exec -T db psql -v ON_ERROR_STOP=1 -P pager=off -U binops_app -d binops_schema_check -f - < binops_comprehensive_db_test.sql

\set ON_ERROR_STOP on
BEGIN;

DO $binops_test$
DECLARE
    v_customer_user UUID;
    v_business_user UUID;
    v_business_org UUID;
    v_psp_org UUID;
    v_facility_org UUID;
    v_pharmacy_org UUID;
    v_lawma_org UUID;
    v_individual_plan UUID;
    v_business_plan UUID;
    v_user_subscription UUID;
    v_business_subscription UUID;
    v_payment UUID;
    v_psp_allocation UUID;
    v_collection_request UUID;
    v_facility UUID;
    v_funding UUID;
    v_credit_account UUID;
    v_issuance UUID;
    v_redemption UUID;
    v_health_settlement UUID;
    v_balance NUMERIC(14,2);
    v_rows INTEGER;
BEGIN
    RAISE NOTICE 'Starting BinOps comprehensive database smoke test';

    -- 1. Users, organisations and memberships
    INSERT INTO users (email, password_hash, first_name, last_name)
    VALUES ('suite.customer@example.test', 'TEST_HASH_ONLY', 'Demo', 'Customer')
    RETURNING id INTO v_customer_user;

    INSERT INTO users (email, password_hash, first_name, last_name)
    VALUES ('suite.business@example.test', 'TEST_HASH_ONLY', 'Demo', 'Business')
    RETURNING id INTO v_business_user;

    INSERT INTO organisations (name, organisation_type, contact_email, service_area)
    VALUES ('Suite Demo Business', 'business', 'suite.business@example.test', 'Demo Area')
    RETURNING id INTO v_business_org;

    INSERT INTO organisations (name, organisation_type, contact_email, service_area)
    VALUES ('Suite Demo PSP', 'psp_operator', 'suite.psp@example.test', 'Demo Area')
    RETURNING id INTO v_psp_org;

    INSERT INTO organisations (name, organisation_type, contact_email, service_area)
    VALUES ('Suite Demo Recovery Facility', 'recycling_facility', 'suite.facility@example.test', 'Demo Area')
    RETURNING id INTO v_facility_org;

    INSERT INTO organisations (name, organisation_type, contact_email)
    VALUES ('Suite Demo Pharmacy', 'pharmacy', 'suite.pharmacy@example.test')
    RETURNING id INTO v_pharmacy_org;

    INSERT INTO organisations (name, organisation_type, contact_email)
    VALUES ('Suite Demo Regulatory Authority', 'lawma_authority', 'suite.authority@example.test')
    RETURNING id INTO v_lawma_org;

    INSERT INTO organisation_members (organisation_id, user_id)
    VALUES (v_business_org, v_business_user);

    RAISE NOTICE 'PASS 1/8: users, organisations and organisation membership';

    -- 2. Service plans, subscriptions, payment, allocations and reconciliation
    INSERT INTO service_plans (code, name, customer_type, price, billing_interval)
    VALUES ('SUITE-IND-001', 'Suite Individual Plan', 'individual', 1000, 'one_time')
    RETURNING id INTO v_individual_plan;

    INSERT INTO service_plans (code, name, customer_type, price, billing_interval)
    VALUES ('SUITE-BIZ-001', 'Suite Business Plan', 'business', 5000, 'monthly')
    RETURNING id INTO v_business_plan;

    INSERT INTO subscriptions (plan_id, subscriber_user_id)
    VALUES (v_individual_plan, v_customer_user)
    RETURNING id INTO v_user_subscription;

    INSERT INTO subscriptions (plan_id, subscriber_organisation_id)
    VALUES (v_business_plan, v_business_org)
    RETURNING id INTO v_business_subscription;

    INSERT INTO payments (
        payer_user_id, subscription_id, purpose, amount, status,
        gateway_provider, gateway_reference, paid_at
    )
    VALUES (
        v_customer_user, v_user_subscription, 'subscription', 1000, 'successful',
        'suite_demo_gateway', 'SUITE-PAY-001', NOW()
    )
    RETURNING id INTO v_payment;

    INSERT INTO payment_allocations (payment_id, allocation_type, amount)
    VALUES (v_payment, 'platform_commission', 200);

    INSERT INTO payment_allocations (
        payment_id, allocation_type, beneficiary_organisation_id, amount
    )
    VALUES (v_payment, 'psp_operator', v_psp_org, 700)
    RETURNING id INTO v_psp_allocation;

    INSERT INTO payment_allocations (payment_id, allocation_type, amount)
    VALUES (v_payment, 'processing_fee', 100);

    INSERT INTO psp_settlements (
        payment_allocation_id, psp_organisation_id, amount, status,
        settlement_reference, settled_at
    )
    VALUES (
        v_psp_allocation, v_psp_org, 700, 'paid',
        'SUITE-PSP-SETTLE-001', NOW()
    );

    INSERT INTO payment_reconciliations (
        payment_id, gross_amount, allocated_amount, status, reconciled_at
    )
    VALUES (v_payment, 1000, 1000, 'matched', NOW());

    RAISE NOTICE 'PASS 2/8: plans, individual/business subscriptions, payment, allocations, PSP settlement and reconciliation';

    -- 3. Collection request lifecycle, facility and waste handover
    INSERT INTO collection_facilities (
        organisation_id, facility_code, facility_address, service_area, is_approved
    )
    VALUES (
        v_facility_org, 'SUITE-FAC-001',
        'Synthetic facility address - not a real service location',
        'Demo Area', TRUE
    )
    RETURNING id INTO v_facility;

    INSERT INTO collection_requests (
        customer_user_id, assigned_psp_organisation_id,
        service_address_ciphertext, service_address_key_version,
        service_area, waste_category, bin_fullness, status,
        scheduled_for
    )
    VALUES (
        v_customer_user, v_psp_org, decode('a1b2c3d4', 'hex'), 'test-key-v1',
        'Demo Area', 'mixed household', 'full', 'assigned', NOW()
    )
    RETURNING id INTO v_collection_request;

    INSERT INTO collection_events (
        collection_request_id, actor_user_id, event_type, notes
    )
    VALUES
        (v_collection_request, v_customer_user, 'request_created', 'Synthetic request created'),
        (v_collection_request, v_customer_user, 'operator_assigned', 'Synthetic PSP assigned'),
        (v_collection_request, v_customer_user, 'collection_scheduled', 'Synthetic collection scheduled'),
        (v_collection_request, v_customer_user, 'collection_started', 'Synthetic collection started'),
        (v_collection_request, v_customer_user, 'waste_collected', 'Synthetic waste collection recorded'),
        (v_collection_request, v_customer_user, 'facility_handover', 'Synthetic facility handover recorded'),
        (v_collection_request, v_customer_user, 'collection_verified', 'Synthetic collection verified');

    INSERT INTO waste_handover_records (
        collection_request_id, facility_id, recorded_by_user_id,
        waste_category, quantity, quantity_unit, evidence_hash, received_at
    )
    VALUES (
        v_collection_request, v_facility, v_customer_user,
        'mixed household', 12.500, 'kg', repeat('a', 64), NOW()
    );

    UPDATE collection_requests
    SET status = 'verified', completed_at = NOW()
    WHERE id = v_collection_request;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Collection request status update did not affect exactly one row';
    END IF;

    RAISE NOTICE 'PASS 3/8: collection lifecycle, facility registration, handover record and evidence hash';

    -- 4. Notifications and audit trail
    INSERT INTO notifications (
        user_id, collection_request_id, type, title, message, status
    )
    VALUES (
        v_customer_user, v_collection_request, 'collection_completed',
        'Collection completed', 'Your demo collection has been verified.', 'pending'
    );

    INSERT INTO audit_logs (
        actor_user_id, actor_organisation_id, action, entity_type, entity_id, metadata
    )
    VALUES (
        v_customer_user, v_lawma_org, 'collection.verified',
        'collection_request', v_collection_request,
        '{"source":"comprehensive_smoke_test","synthetic":true}'::jsonb
    );

    RAISE NOTICE 'PASS 4/8: customer notification and audit log';

    -- 5. Health Credit funding, account, issuance, redemption and balance
    INSERT INTO health_credit_funding (
        source_type, source_reference, amount_funded, currency,
        status, confirmed_at, created_by_user_id
    )
    VALUES (
        'sponsorship', 'SUITE-FUND-001', 50000, 'NGN',
        'confirmed', NOW(), v_customer_user
    )
    RETURNING id INTO v_funding;

    INSERT INTO health_credit_accounts (owner_user_id)
    VALUES (v_customer_user)
    RETURNING id INTO v_credit_account;

    INSERT INTO health_credit_transactions (
        account_id, funding_id, transaction_type, credit_delta,
        idempotency_key, description, created_by_user_id
    )
    VALUES (
        v_credit_account, v_funding, 'issuance', 5000,
        'SUITE-ISSUE-001', 'Synthetic funded credit issuance', v_customer_user
    )
    RETURNING id INTO v_issuance;

    INSERT INTO health_credit_transactions (
        account_id, transaction_type, credit_delta,
        healthcare_partner_organisation_id, redemption_value_ngn,
        idempotency_key, description, created_by_user_id
    )
    VALUES (
        v_credit_account, 'redemption', -1500,
        v_pharmacy_org, 1500,
        'SUITE-REDEEM-001', 'Synthetic pharmacy redemption', v_customer_user
    )
    RETURNING id INTO v_redemption;

    SELECT available_credits
    INTO v_balance
    FROM health_credit_account_balances
    WHERE account_id = v_credit_account;

    IF v_balance IS DISTINCT FROM 3500.00 THEN
        RAISE EXCEPTION 'Health Credit balance mismatch: expected 3500.00, got %', v_balance;
    END IF;

    RAISE NOTICE 'PASS 5/8: confirmed funding, credit issuance, redemption and balance view (balance: % BHC)', v_balance;

    -- 6. Healthcare partner settlement and redemption linkage
    INSERT INTO healthcare_settlements (
        healthcare_partner_organisation_id, amount_ngn, status,
        settlement_reference, period_start, period_end, settled_at
    )
    VALUES (
        v_pharmacy_org, 1500, 'paid', 'SUITE-HEALTH-SETTLE-001',
        CURRENT_DATE, CURRENT_DATE, NOW()
    )
    RETURNING id INTO v_health_settlement;

    INSERT INTO healthcare_settlement_items (
        settlement_id, health_credit_transaction_id, amount_ngn
    )
    VALUES (v_health_settlement, v_redemption, 1500);

    RAISE NOTICE 'PASS 6/8: healthcare partner settlement and redemption linkage';

    -- 7. Integrity guard: duplicate Health Credit idempotency key must be rejected
    BEGIN
        INSERT INTO health_credit_transactions (
            account_id, funding_id, transaction_type, credit_delta,
            idempotency_key, description, created_by_user_id
        )
        VALUES (
            v_credit_account, v_funding, 'issuance', 1,
            'SUITE-ISSUE-001', 'Intentional duplicate-key test', v_customer_user
        );

        RAISE EXCEPTION 'Duplicate Health Credit idempotency key was unexpectedly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'PASS 7/8: duplicate Health Credit idempotency key rejected';
    END;

    -- 8. Integrity guard: audit metadata must be a JSON object
    BEGIN
        INSERT INTO audit_logs (actor_user_id, action, entity_type, metadata)
        VALUES (v_customer_user, 'invalid.test', 'test', '[]'::jsonb);

        RAISE EXCEPTION 'Non-object audit metadata was unexpectedly accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'PASS 8/8: invalid audit metadata rejected';
    END;

    RAISE NOTICE 'ALL TESTS PASSED: BinOps consolidated database smoke test completed successfully';
END
$binops_test$;

ROLLBACK;
