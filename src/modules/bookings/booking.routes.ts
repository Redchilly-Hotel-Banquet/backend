import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { bookingController } from "./booking.controller.js";

export const publicBookingRouter = Router();
publicBookingRouter.post("/", bookingController.createPublic);

export const adminBookingRouter = Router();
adminBookingRouter.use(authenticate(["admin", "rooms"]));
adminBookingRouter.post("/manage", bookingController.adminManage);
adminBookingRouter.post("/checkin", bookingController.checkin);
adminBookingRouter.post("/billing", bookingController.billing);
