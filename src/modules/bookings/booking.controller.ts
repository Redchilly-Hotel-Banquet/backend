import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { bookingService } from "./booking.service.js";

class BookingController {
  createPublic = async (req: Request, res: Response) => {
    const response = await bookingService.createPublic(req.body ?? {});
    return sendSuccess(res, response);
  };

  adminManage = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await bookingService.manage(req.body, req.user);
    return sendSuccess(res, response);
  };

  checkin = async (req: AuthenticatedRequest, res: Response) => {
    const response = await bookingService.checkin(
      req.body ?? {},
      req.user ?? null,
    );
    return sendSuccess(res, response);
  };

  billing = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await bookingService.billing(req.body, req.user);
    return sendSuccess(res, response);
  };
}

export const bookingController = new BookingController();
