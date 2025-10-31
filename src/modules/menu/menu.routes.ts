import { Router } from "express";
import { menuController } from "./menu.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const menuRouter = Router();

menuRouter.post("/query", asyncHandler(menuController.getMenu));
