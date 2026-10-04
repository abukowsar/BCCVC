import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "./db-schema";
import { getDb } from "./mongodb";
import type { Role, SessionUser, TeamMember, UserStatus } from "@/app/admin/session-types";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export type UserDoc = {
  _id: ObjectId;
  username: string;
  name: string;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Id used in sessions for the built-in super admin defined in .env.local */
export const BUILT_IN_ID = "env";

export const USERNAME_PATTERN = /^[a-z0-9._@-]{3,64}$/;
export const MIN_PASSWORD_LENGTH = 8;

// The unique username index is created by ensureSchema (src/lib/db-schema.ts)
export async function getUsersCollection() {
  return (await getDb()).collection<UserDoc>(COLLECTIONS.users);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function builtInUser(): SessionUser {
  return { id: BUILT_IN_ID, username: process.env.ADMIN_USERNAME ?? "admin", name: process.env.ADMIN_NAME || "সুপার অ্যাডমিন", role: "super-admin", builtIn: true };
}

export function toSessionUser(doc: UserDoc): SessionUser {
  return { id: doc._id.toHexString(), username: doc.username, name: doc.name, role: doc.role, builtIn: false };
}

export function toTeamMember(doc: UserDoc): TeamMember {
  return { ...toSessionUser(doc), status: doc.status, createdAt: doc.createdAt.getTime() };
}

export async function findActiveUserById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return (await getUsersCollection()).findOne({ _id: new ObjectId(id), status: "active" });
}
