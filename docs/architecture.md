# BinOps - Technical Architecture

## 1. Architecture Overview

BinOps will use a modular monolith architecture for its graduation MVP.

The system consists of a React frontend, Node.js backend, PostgreSQL database and EVM-compatible blockchain.

## 2. Technology Decisions

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Blockchain | Solidity, Hardhat |
| Blockchain integration | ethers.js |
| Version control | Git, GitHub |

## 3. Application Components

### Frontend
Responsible for user interfaces, registration, collection requests, operator workflows, reward balances and administration.

### Backend
Responsible for authentication, authorisation, business rules, collection workflows, reward eligibility, ledger operations and blockchain integration.

### Database
PostgreSQL is the authoritative operational data store.

It manages users, organisations, subscriptions, collection jobs, evidence references, facility confirmations, Health Credit transactions, redemptions and settlements.

### Blockchain
Smart contracts preserve cryptographic proofs of selected business events.

The blockchain does not independently establish that physical waste collection or recycling occurred.

## 4. Core Business Workflow

1. A household or business registers.
2. The customer selects a subscription plan.
3. A simulated payment is recorded.
4. The customer requests waste collection.
5. An administrator assigns an operator.
6. The operator submits collection evidence.
7. Waste handover is recorded.
8. The receiving facility confirms receipt.
9. The backend validates reward eligibility.
10. Funded Health Credits are issued.
11. An eligible healthcare partner verifies a redemption.
12. The platform records the redemption and settlement.
13. Selected events receive blockchain audit proofs.

## 5. Health Credit Architecture

BinOps Health Credits (BHC) will initially use a backend-managed ledger.

Credits are non-transferable and cannot be exchanged for cash.

Issuance requires:
- An eligible verified activity.
- An identifiable funding allocation.
- A unique transaction reference.
- An auditable ledger entry.

The ledger must support reversals and reconciliation.

Blockchain records proofs of issuance and redemption, not personal or medical information.

## 6. Blockchain Data Boundaries

Only selected event metadata and cryptographic hashes should be recorded on-chain.

Never store:
- Names or contact information.
- Home addresses.
- Medical records or diagnoses.
- Payment credentials.
- Private keys or authentication secrets.

The database retains the underlying operational records.

## 7. Security and Access Control

The backend must enforce role-based access for:

- Households and businesses.
- Waste operators.
- Receiving facilities.
- Healthcare partners.
- Administrators.

All sensitive operations require server-side validation and authorisation.

Credentials and environment variables must not be committed to Git.

## 8. MVP Environment

The graduation demonstration will use:

- Synthetic user and operational data.
- Simulated subscription payments.
- A local Hardhat blockchain.
- Test Health Credit funding allocations.
- Simulated healthcare redemptions.

No real-money payment or healthcare coverage will be represented as operational.

## 9. Architectural Constraints

- PostgreSQL remains the source of truth for operational state.
- Blockchain is an audit-proof layer, not the primary application database.
- Physical events require supporting evidence and participant confirmation.
- No unconfirmed regulatory approval or commercial partnership will be claimed.
- The architecture must remain simple enough to deliver and demonstrate within the graduation timeline.

## 10. Current Status

Architecture baseline documented.

Implementation and integration remain pending.
