import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDirectory, "../../../.env"),
});

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).optional(),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(5433),
  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default("1h"),
  COLLECTION_ADDRESS_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  COLLECTION_ADDRESS_KEY_VERSION: z.string().min(1).max(50),
  BLOCKCHAIN_RPC_URL: z.string().url(),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive(),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  SEPOLIA_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  FRONTEND_URL: z.string().url().optional(),
}).refine(
  (config) =>
    Boolean(config.DATABASE_URL) ||
    Boolean(config.POSTGRES_USER && config.POSTGRES_PASSWORD && config.POSTGRES_DB),
  {
    message: "Configure DATABASE_URL or all three local PostgreSQL credentials.",
  },
);

export const env = envSchema.parse(process.env);
