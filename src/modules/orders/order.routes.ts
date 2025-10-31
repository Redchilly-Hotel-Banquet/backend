import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { orderController } from "./order.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const publicOrderRouter = Router();
publicOrderRouter.post("/", asyncHandler(orderController.create));
publicOrderRouter.post("/guest", asyncHandler(orderController.guestOrders));
publicOrderRouter.post("/detail", asyncHandler(orderController.getOrder));

export const adminOrderRouter = Router();
adminOrderRouter.use(authenticate(["admin", "kitchen"]));
adminOrderRouter.post("/manage", asyncHandler(orderController.adminManage));
