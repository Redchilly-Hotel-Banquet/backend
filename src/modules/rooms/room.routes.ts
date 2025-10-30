import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { roomController } from "./room.controller.js";

export const publicRoomRouter = Router();
publicRoomRouter.post("/availability", roomController.availability);

export const adminRoomRouter = Router();
adminRoomRouter.use(authenticate(["admin", "rooms"]));
adminRoomRouter.post("/manage", roomController.manage);
adminRoomRouter.post("/pricing", roomController.pricing);
