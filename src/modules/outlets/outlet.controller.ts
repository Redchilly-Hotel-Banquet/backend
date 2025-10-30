import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { outletService } from "./outlet.service.js";

class OutletController {
  listPublic = async (_req: AuthenticatedRequest, res: Response) => {
    const response = await outletService.listPublic();
    return sendSuccess(res, response);
  };

  manage = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await outletService.manage(req.body);
    return sendSuccess(res, response);
  };
}

export const outletController = new OutletController();
