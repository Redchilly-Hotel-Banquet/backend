import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { logger } from "./core/logger.js";
import { routes } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: "*",
      allowedHeaders: ["authorization", "content-type"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV });
  });

  app.use("/api", routes);

  app.use(errorHandler);

  return app;
};
