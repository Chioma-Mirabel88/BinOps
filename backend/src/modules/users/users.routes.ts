import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import {
  getMyProfileController,
  getActivePspOrganisationsController,
  getActiveRecyclerOrganisationsController,
} from "./users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticateToken, getMyProfileController);

usersRouter.get(
  "/psp-organisations",
  authenticateToken,
  getActivePspOrganisationsController,
);

usersRouter.get(
  "/recycler-organisations",
  authenticateToken,
  getActiveRecyclerOrganisationsController,
);

export default usersRouter;
