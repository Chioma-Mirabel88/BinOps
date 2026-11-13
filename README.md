# BinOps
## Clean Communities. Healthier Lives.

**Campaign:** Just Bin It.

BinOps is a blockchain-powered waste-management coordination and environmental-health rewards platform initially designed for Lagos, Nigeria.

## Project Vision

BinOps connects households, businesses, waste collection operators, receiving facilities, and healthcare partners.

The platform aims to improve waste collection coordination, operational accountability, responsible disposal, and access to funded healthcare-related rewards.

## Core Features

- Household and business registration
- Subscription management
- Waste collection requests and assignments
- Operator collection evidence
- Waste handover and facility confirmation
- BinOps Health Credits (BHC)
- Healthcare partner redemption
- Partner reconciliation
- Blockchain-backed audit records

## Health Credits

BinOps Health Credits are proposed, non-transferable reward units for eligible waste-management activities.

Credits must be backed by identifiable funding and redeemed only through approved healthcare partners.

The illustrative conversion is 1 BHC = NGN 1 in eligible redemption value. This is a proposal, not a final commercial commitment.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Node.js |
| Database | PostgreSQL |
| Smart contracts | Solidity |
| Development framework | Hardhat |
| Blockchain integration | ethers.js |
| Version control | Git and GitHub |

## Project Structure

- `frontend/` - User interfaces
- `backend/` - APIs and business logic
- `contracts/` - Solidity smart contracts
- `database/` - Schemas and migrations
- `docs/` - Technical documentation
- `scripts/` - Development utilities

## Blockchain Principles

PostgreSQL manages operational data and the Health Credit ledger.

Blockchain stores cryptographic proofs of important platform events. It does not independently verify physical waste collection.

Personal information, medical records, payment details, and home addresses must never be stored directly on-chain.

## MVP Safety

- Synthetic demonstration data only.
- Simulated payments.
- Local blockchain or test network.
- No real-money transactions.
- No claims of actual healthcare coverage.
- No unconfirmed regulatory approvals or partnerships.

## Project Status

The BinOps MVP application and smart contract have been developed.

- Customer, PSP, recycler, healthcare and management workflows implemented.
- Waste collection and PSP-to-recycler handover workflows implemented.
- Healthcare partner directory and Health Credits redemption interface implemented.
- PostgreSQL schema imported into Supabase: 22 tables, 20 enum types and 1 view.
- Row Level Security enabled on all 22 database tables.
- Collection proof smart contract deployed on Ethereum Sepolia testnet.
- Frontend, backend and smart contract builds successfully validated.
- Public application deployment and hosted end-to-end validation remain pending.

## Deployment Architecture

- Frontend: Render Static Site.
- Backend: Render Web Service.
- Database: Supabase PostgreSQL.
- Blockchain: Ethereum Sepolia testnet.

Use synthetic demonstration data and testnet transactions only. Sepolia ETH is not real-money currency.

**BinOps — Clean Communities. Healthier Lives.**
