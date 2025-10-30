import { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/httpError.js";
import { logger } from "../core/logger.js";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    logger.warn({ err }, "Handled HTTP error");
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({
    error: "Internal server error",
  });
};
