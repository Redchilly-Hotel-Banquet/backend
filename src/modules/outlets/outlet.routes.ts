import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { outletController } from "./outlet.controller.js";

export const publicOutletRouter = Router();
publicOutletRouter.get("/", outletController.listPublic);

export const adminOutletRouter = Router();
adminOutletRouter.use(authenticate(["admin"]));
adminOutletRouter.post("/manage", outletController.manage);
