import { MongoClient, Db } from "mongodb";
import { env } from "./env.js";
import { logger } from "../core/logger.js";

class MongoConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<Db> {
    if (!this.client || !this.db) {
      logger.info("Connecting to MongoDB...");
      this.client = new MongoClient(env.MONGO_DB_URI, {});
      await this.client.connect();
      this.client.on("connected", () => {
        logger.info("MongoDB connected");
      });
      this.client.on("error", (err) => {
        logger.error(`MongoDB connection error: ` + err);
      });
      this.client.on("close", () => {
        logger.warn("MongoDB connection closed");
      });
      this.db = this.client.db(env.MONGO_DB_NAME);
    }
    return this.db;
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Mongo database has not been initialised. Call connect() first.");
    }
    return this.db;
  }
}

export const mongoConnection = new MongoConnection();
