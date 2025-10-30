import { Router } from "express";
import { menuController } from "./menu.controller.js";

export const menuRouter = Router();

menuRouter.post("/query", menuController.getMenu);
