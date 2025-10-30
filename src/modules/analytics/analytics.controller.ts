import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { analyticsService } from "./analytics.service.js";

class AnalyticsController {
  getOutletAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await analyticsService.getOutletAnalytics(req.user);
    return sendSuccess(res, response);
  };
}

export const analyticsController = new AnalyticsController();
