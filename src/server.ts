import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { mongoConnection } from "./config/mongo.js";
import { logger } from "./core/logger.js";

const bootstrap = async () => {
  try {
    await mongoConnection.connect();
    logger.info("Connected to MongoDB");

    const app = createApp();
    app.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error({ error }, "Failed to bootstrap application");
    process.exit(1);
  }
};

void bootstrap();
