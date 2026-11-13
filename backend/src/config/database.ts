import { Pool } from "pg";
import { env } from "./env.js";

const connectionConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.POSTGRES_USER!,
      password: env.POSTGRES_PASSWORD!,
      database: env.POSTGRES_DB!,
    };

export const pool = new Pool({
  ...connectionConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", () => {
  console.error("Unexpected error on an idle PostgreSQL connection.");
});
