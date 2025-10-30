import { NextFunction, Request, Response } from "express";
import { logger } from "../core/logger.js";
import { AuthenticatedRequest } from "./authenticate.js";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const isEmptyObject = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return true;
  }

  return Object.keys(value as Record<string, unknown>).length === 0;
};

export const auditLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  const { method, originalUrl, params, query, body } = req;
  const { user } = req as AuthenticatedRequest;

  const baseLog = {
    method,
    url: originalUrl,
    user: user
      ? {
          id: user.id,
          name: user.name,
          roles: user.roles,
          outlets: user.outlets,
        }
      : undefined,
  };

  logger.info(
    {
      audit: {
        ...baseLog,
        params: isEmptyObject(params) ? undefined : params,
        query: isEmptyObject(query) ? undefined : query,
        body:
          METHODS_WITH_BODY.has(method) && !isEmptyObject(body)
            ? body
            : undefined,
      },
    },
    "Incoming request"
  );

  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
    const responseLog = {
      ...baseLog,
      statusCode: res.statusCode,
      durationMs: Math.round(duration * 100) / 100,
    };

    if (res.statusCode >= 500) {
      logger.error({ audit: responseLog }, "Request failed");
    } else if (res.statusCode >= 400) {
      logger.warn({ audit: responseLog }, "Request completed with client error");
    } else {
      logger.info({ audit: responseLog }, "Request completed");
    }
  });

  next();
};
