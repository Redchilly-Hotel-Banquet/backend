import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../core/httpError.js";

export type AuthenticatedUser = {
  id: string;
  name: string;
  roles: string[];
  outlets: string[];
};

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticate =
  (requiredRoles?: string[], requireOutlet = false) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing or invalid authorization header");
    }

    try {
      const token = header.replace("Bearer ", "");
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
      req.user = payload;

      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = payload.roles.some((role) => requiredRoles.includes(role));
        if (!hasRole) {
          throw new HttpError(403, "Insufficient permissions");
        }
      }

      if (requireOutlet && (!payload.outlets || payload.outlets.length === 0)) {
        throw new HttpError(403, "Outlet access required");
      }

      next();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(401, "Invalid token");
    }
  };
