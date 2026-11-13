import { Contract, JsonRpcProvider, Wallet, id, isHexString } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../../config/env.js";
import { pool } from "../../config/database.js";

const artifactPath = resolve(
  process.cwd(),
  "../contracts/artifacts/contracts/BinOpsCollectionProof.sol/BinOpsCollectionProof.json",
);

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
  abi: object[];
};

const provider = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
const signer = new Wallet(env.SEPOLIA_PRIVATE_KEY, provider);

export async function recordCollectionProof(
  collectionRequestId: string,
  evidenceHash: string,
) {
  if (!isHexString(evidenceHash, 32)) {
    throw new Error("Evidence hash must be a 32-byte hexadecimal value.");
  }

  const network = await provider.getNetwork();

  if (network.chainId !== BigInt(env.BLOCKCHAIN_CHAIN_ID)) {
    throw new Error("Blockchain RPC is connected to an unexpected network.");
  }

  const contract = new Contract(
    env.BLOCKCHAIN_CONTRACT_ADDRESS,
    artifact.abi,
    signer,
  );

  const collectionReference = id(collectionRequestId);

  const transaction = await contract.getFunction("recordProof")(
    collectionReference,
    evidenceHash,
  );

  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error("Blockchain transaction was not confirmed.");
  }

  return {
    collectionReference,
    transactionHash: transaction.hash as string,
    blockNumber: receipt.blockNumber,
  };
}


export async function getCollectionProofs() {
  const result = await pool.query(
    `SELECT id,
            collection_request_id AS "collectionRequestId",
            chain_id AS "chainId",
            contract_address AS "contractAddress",
            collection_reference AS "collectionReference",
            evidence_hash AS "evidenceHash",
            transaction_hash AS "transactionHash",
            status,
            created_at AS "createdAt",
            confirmed_at AS "confirmedAt"
     FROM collection_blockchain_proofs
     ORDER BY created_at DESC
     LIMIT 100`
  );

  const providerNetwork = await provider.getNetwork();
  const configuredChainId = BigInt(env.BLOCKCHAIN_CHAIN_ID);

  const contract = new Contract(
    env.BLOCKCHAIN_CONTRACT_ADDRESS,
    artifact.abi,
    provider,
  );

  return Promise.all(
    result.rows.map(async (proof) => {
      if (proof.status !== "confirmed") {
        return { ...proof, verificationStatus: "not_confirmed" };
      }

      if (
        BigInt(proof.chainId) !== configuredChainId ||
        providerNetwork.chainId !== configuredChainId ||
        proof.contractAddress.toLowerCase() !==
          env.BLOCKCHAIN_CONTRACT_ADDRESS.toLowerCase()
      ) {
        return { ...proof, verificationStatus: "unavailable" };
      }

      try {
        const onChainProof = await contract.getFunction("verifyProof")(
          proof.collectionReference,
        );

        const referenceMatches =
          String(onChainProof[0]).toLowerCase() ===
          proof.collectionReference.toLowerCase();

        const hashMatches =
          String(onChainProof[1]).toLowerCase() ===
          proof.evidenceHash.toLowerCase();

        return {
          ...proof,
          verificationStatus:
            referenceMatches && hashMatches ? "verified" : "mismatch",
        };
      } catch {
        return { ...proof, verificationStatus: "unavailable" };
      }
    }),
  );
}
