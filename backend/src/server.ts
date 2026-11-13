import app from "./app.js";
import { pool } from "./config/database.js";

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`BinOps API server listening on port ${port}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down BinOps API...`);
  server.close(() => {
    void pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
