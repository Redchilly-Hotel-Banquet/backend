import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { orderService } from "./order.service.js";

class OrderController {
  create = async (req: AuthenticatedRequest, res: Response) => {
    const response = await orderService.createOrder(req.body);
    return sendSuccess(res, response, 201);
  };

  guestOrders = async (req: AuthenticatedRequest, res: Response) => {
    const response = await orderService.getGuestOrders(req.body);
    return sendSuccess(res, response);
  };

  getOrder = async (req: AuthenticatedRequest, res: Response) => {
    const response = await orderService.getOrder(req.body);
    return sendSuccess(res, response);
  };

  adminManage = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Missing authenticated user context");
    }
    const response = await orderService.adminManage(req.body, req.user);
    return sendSuccess(res, response);
  };
}

export const orderController = new OrderController();
