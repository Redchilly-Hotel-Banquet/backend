import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { orderController } from "./order.controller.js";

export const publicOrderRouter = Router();
publicOrderRouter.post("/", orderController.create);
publicOrderRouter.post("/guest", orderController.guestOrders);
publicOrderRouter.post("/detail", orderController.getOrder);

export const adminOrderRouter = Router();
adminOrderRouter.use(authenticate(["admin", "kitchen"]));
adminOrderRouter.post("/manage", orderController.adminManage);
