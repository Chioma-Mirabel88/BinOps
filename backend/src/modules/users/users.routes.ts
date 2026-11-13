import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireOversightAccess } from "../../middleware/organisation-auth.middleware.js";
import {
  getMyProfileController,
  getActivePspOrganisationsController,
} from "./users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticateToken, getMyProfileController);

usersRouter.get(
  "/psp-organisations",
  authenticateToken,
  requireOversightAccess,
  getActivePspOrganisationsController,
);

export default usersRouter;
