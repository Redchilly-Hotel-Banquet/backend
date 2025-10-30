import { Router } from "express";
import { locationController } from "./location.controller.js";

export const locationRouter = Router();

locationRouter.post("/validate", locationController.validate);
