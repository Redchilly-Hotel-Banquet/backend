import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { categoryController } from "./category.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const adminCategoryRouter = Router();
adminCategoryRouter.use(authenticate(["admin"]));
adminCategoryRouter.post("/manage", asyncHandler(categoryController.manage));
