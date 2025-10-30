import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { bookingService } from "./booking.service.js";

class BookingController {
  adminManage = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await bookingService.manage(req.body, req.user);
    return sendSuccess(res, response);
  };

  checkin = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user");
    }
    const response = await bookingService.checkin(req.body, req.user);
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
