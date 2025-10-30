import { Response } from "express";

export const sendSuccess = <T>(res: Response, payload: T, status = 200) => {
  return res.status(status).json(payload);
};

export const sendError = (res: Response, status: number, message: string, details?: unknown) => {
  return res.status(status).json({ error: message, details });
};
