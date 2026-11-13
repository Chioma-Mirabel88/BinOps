BEGIN;

ALTER TYPE organisation_type ADD VALUE IF NOT EXISTS 'binops';

COMMIT;
