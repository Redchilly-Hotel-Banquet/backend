import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { sendSuccess } from "../../utils/response.js";
import { categoryService } from "./category.service.js";

class CategoryController {
  manage = async (req: AuthenticatedRequest, res: Response) => {
    const response = await categoryService.manage(req.body);
    return sendSuccess(res, response);
  };
}

export const categoryController = new CategoryController();
