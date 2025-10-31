import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { outletController } from "./outlet.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const publicOutletRouter = Router();
publicOutletRouter.get("/", asyncHandler(outletController.listPublic));

export const adminOutletRouter = Router();
adminOutletRouter.use(authenticate(["admin"]));
adminOutletRouter.post("/manage", asyncHandler(outletController.manage));
