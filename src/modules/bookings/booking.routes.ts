import { Router } from "express";
import { bookingController } from "./booking.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const publicBookingRouter = Router();
publicBookingRouter.post("/", asyncHandler(bookingController.createPublic));
publicBookingRouter.post("/checkin", asyncHandler(bookingController.checkin));

export const adminBookingRouter = Router();
adminBookingRouter.use(authenticate(["admin", "rooms"]));
adminBookingRouter.post("/manage", asyncHandler(bookingController.adminManage));
adminBookingRouter.post("/checkin", asyncHandler(bookingController.checkin));
adminBookingRouter.post("/billing", asyncHandler(bookingController.billing));
