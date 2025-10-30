import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  MONGO_DB_URI: z.string().min(1, "MONGO_DB_URI is required"),
  MONGO_DB_NAME: z.string().min(1, "MONGO_DB_NAME is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  TOKEN_EXPIRES_IN: z.string().default("12h"),
  ADMIN_DEFAULT_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
