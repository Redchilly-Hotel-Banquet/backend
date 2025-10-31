import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { roomController } from "./room.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const publicRoomRouter = Router();
publicRoomRouter.post("/availability", asyncHandler(roomController.availability));

export const adminRoomRouter = Router();
adminRoomRouter.use(authenticate(["admin", "rooms"]));
adminRoomRouter.post("/manage", asyncHandler(roomController.manage));
adminRoomRouter.post("/pricing", asyncHandler(roomController.pricing));
