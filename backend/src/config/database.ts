import { Pool } from "pg";
import { env } from "./env.js";

const usingDatabaseUrl = Boolean(env.DATABASE_URL);

if (usingDatabaseUrl && env.DATABASE_URL) {
  const parsed = new URL(env.DATABASE_URL);

  console.info("PostgreSQL connection diagnostics:", {
    source: "DATABASE_URL",
    username: decodeURIComponent(parsed.username),
    hostname: parsed.hostname,
    port: parsed.port,
    database: parsed.pathname,
    passwordPresent: Boolean(parsed.password),
  });
} else {
  console.info("PostgreSQL connection diagnostics:", {
    source: "individual environment variables",
    username: env.POSTGRES_USER,
    hostname: env.DB_HOST,
    port: env.DB_PORT,
    database: env.POSTGRES_DB,
    passwordPresent: Boolean(env.POSTGRES_PASSWORD),
  });
}

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
