import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { analyticsController } from "./analytics.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(authenticate(["admin"]));
adminAnalyticsRouter.post("/outlets", asyncHandler(analyticsController.getOutletAnalytics));
