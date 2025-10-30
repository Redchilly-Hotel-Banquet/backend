import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { categoryController } from "./category.controller.js";

export const adminCategoryRouter = Router();
adminCategoryRouter.use(authenticate(["admin"]));
adminCategoryRouter.post("/manage", categoryController.manage);
