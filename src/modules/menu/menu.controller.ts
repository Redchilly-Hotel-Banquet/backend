import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { menuService } from "./menu.service.js";

class MenuController {
  getMenu = async (req: Request, res: Response) => {
    const response = await menuService.getMenu(req.body ?? {});
    return sendSuccess(res, response);
  };
}

export const menuController = new MenuController();
