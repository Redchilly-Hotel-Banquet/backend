import { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncishHandler = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<unknown> | unknown;

export const asyncHandler = (handler: AsyncishHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
