import { pool } from "./config/database.js";
import { env } from "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./modules/auth/auth.routes.js";
import usersRouter from "./modules/users/users.routes.js";
import healthCreditsRouter, { customerHealthCreditsRouter, healthcarePartnerHealthCreditsRouter } from "./modules/health-credits/health-credits.routes.js";
import collectionsRouter, { oversightCollectionsRouter, pspCollectionsRouter, recyclerCollectionsRouter } from "./modules/collections/collections.routes.js";
import blockchainRouter from "./modules/blockchain/blockchain.routes.js";

const app = express();

app.use(helmet());
const allowedOrigins = [
  "http://localhost:5173",
  env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/oversight/collections", oversightCollectionsRouter);
app.use("/api/psp/collections", pspCollectionsRouter);
app.use("/api/recycler/collections", recyclerCollectionsRouter);
app.use("/api/oversight/health-credits", healthCreditsRouter);
app.use("/api/oversight/blockchain", blockchainRouter);
app.use("/api/health-credits", customerHealthCreditsRouter);
app.use("/api/healthcare/health-credits", healthcarePartnerHealthCreditsRouter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "BinOps API is running.",
  });
});


app.get("/api/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      status: "ready",
      database: "connected",
    });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };

    console.error("Database readiness check failed:", {
      code: dbError.code ?? "UNKNOWN",
      message: dbError.message ?? "Unknown database error",
    });

    return res.status(503).json({
      status: "not_ready",
      database: "unavailable",
    });
  }
});

export default app;
