import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { authService } from "./auth.service.js";
import { LoginRequest } from "./auth.types.js";

class AuthController {
  login = async (req: Request, res: Response) => {
    const payload = req.body as LoginRequest;
    const response = await authService.login(payload);
    return sendSuccess(res, response);
  };
}

export const authController = new AuthController();
