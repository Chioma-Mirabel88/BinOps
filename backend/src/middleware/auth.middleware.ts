import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return res.status(401).json({
        error: "Invalid authentication token.",
      });
    }

    req.auth = { userId: decoded.sub };

    return next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired authentication token.",
    });
  }
}
