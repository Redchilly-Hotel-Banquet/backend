import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.js";
import { locationService } from "./location.service.js";

class LocationController {
  validate = async (req: Request, res: Response) => {
    const response = await locationService.validate(req.body ?? {});
    return sendSuccess(res, response);
  };
}

export const locationController = new LocationController();
