import jwt, { SignOptions } from "jsonwebtoken";
import { Document } from "mongodb";
import { env } from "../../config/env.js";
import { mongoConnection } from "../../config/mongo.js";
import { HttpError } from "../../core/httpError.js";
import { stringifyId } from "../../utils/objectId.js";
import { AuthUser, LoginRequest, LoginResponse } from "./auth.types.js";

const parseRoles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    const roles = raw
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : null))
      .filter((entry): entry is string => Boolean(entry));
    return roles.length > 0 ? Array.from(new Set(roles)) : ["admin"];
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim().toLowerCase()];
  }
  return ["admin"];
};

const parseOutlets = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    const outlets = raw
      .map((entry) => (typeof entry === "string" ? entry.trim() : null))
      .filter((entry): entry is string => Boolean(entry));
    return outlets.length > 0 ? Array.from(new Set(outlets)) : ["all"];
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return ["all"];
};

const buildUser = (doc: Document): AuthUser => {
  return {
    id: stringifyId(doc._id) ?? "unknown",
    name: typeof doc.name === "string" ? doc.name : "Admin",
    roles: parseRoles(doc.purpose),
    outlets: parseOutlets(doc.outlets),
  };
};

export class AuthService {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { userName, password } = payload;
    if (!userName || !password) {
      throw new HttpError(400, "Username and password are required");
    }

    const db = mongoConnection.getDb();
    const configs = db.collection("configs");

    const userDoc = await configs.findOne(
      {
        name: userName,
        isActive: true,
      },
      {
        collation: { locale: "en", strength: 2 },
      }
    );

    const isDefaultAdmin = env.ADMIN_DEFAULT_PASSWORD && password === env.ADMIN_DEFAULT_PASSWORD;

    if (!userDoc) {
      if (isDefaultAdmin) {
        const user: AuthUser = {
          id: "default-admin",
          name: "Admin",
          roles: ["admin"],
          outlets: ["all"],
        };
        return this.issueToken(user);
      }
      throw new HttpError(401, "Invalid credentials");
    }

    const storedPassword =
      typeof userDoc.adminPassword === "string" ? userDoc.adminPassword : env.ADMIN_DEFAULT_PASSWORD;

    if (!storedPassword || storedPassword !== password) {
      if (!isDefaultAdmin) {
        throw new HttpError(401, "Invalid credentials");
      }
    }

    const user = buildUser(userDoc);
    return this.issueToken(user);
  }

  issueToken(user: AuthUser): LoginResponse {
    const token = jwt.sign(user, env.JWT_SECRET as jwt.Secret, {
      expiresIn: env.TOKEN_EXPIRES_IN,
    } as SignOptions);
    return { token, user };
  }
}

export const authService = new AuthService();
