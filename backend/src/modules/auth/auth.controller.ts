import type { Request, Response } from "express";
import { loginSchema, registrationSchema } from "./auth.schema.js";
import { loginUser, registerUser } from "./auth.service.js";

export async function registerController(
  req: Request,
  res: Response,
) {
  const validation = registrationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid registration details.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await registerUser(validation.data);
    return res.status(201).json({
      message: "Account created successfully.",
      user: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "An account with this email already exists.") {
      return res.status(409).json({
        error: error.message,
      });
    }

    console.error("Registration failed.");
    return res.status(500).json( {
      error: "Registration could not be completed.",
    });
  }
}


export async function loginController(
  req: Request,
  res: Response,
) {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid login details.",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await loginUser(validation.data);

    return res.status(200).json({
      message: "Login successful.",
      ...result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid email or password."
    ) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    console.error("Login failed.");
    return res.status(500).json({
      error: "Login could not be completed.",
    });
  }
}
