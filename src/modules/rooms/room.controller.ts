import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { roomService } from "./room.service.js";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { HttpError } from "../../core/httpError.js";

class RoomController {
  availability = async (req: Request, res: Response) => {
    const result = await roomService.getAvailability(req.body ?? {});
    return sendSuccess(res, result);
  };

  manage = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }
    const result = await roomService.manageRooms(req.body ?? {}, req.user);
    return sendSuccess(res, result);
  };

  pricing = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }
    const result = await roomService.managePricing(req.body ?? {}, req.user);
    return sendSuccess(res, result);
  };
}

export const roomController = new RoomController();
