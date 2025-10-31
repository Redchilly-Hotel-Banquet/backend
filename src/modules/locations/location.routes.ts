import { Router } from "express";
import { locationController } from "./location.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const locationRouter = Router();

locationRouter.post("/validate", asyncHandler(locationController.validate));
