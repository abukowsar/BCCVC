import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { canManageTeam, type SessionUser } from "@/app/admin/session-types";
import { BUILT_IN_ID, builtInUser, findActiveUserById, getUsersCollection, toSessionUser, verifyPassword } from "./users";

export const SESSION_COOKIE = "bccvc_admin";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set in .env.local (at least 32 characters)");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function checkBuiltInCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env.local");
  // Evaluate both comparisons so timing does not reveal which field was wrong
  const userOk = safeEqual(username, expectedUser);
  const passwordOk = safeEqual(password, expectedPassword);
  return userOk && passwordOk;
}

/** Checks the built-in super admin from .env.local first, then operator accounts in MongoDB. */
export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const normalized = username.trim().toLowerCase();
  if (normalized === process.env.ADMIN_USERNAME?.toLowerCase()) {
    return checkBuiltInCredentials(normalized, password) ? builtInUser() : null;
  }
  const user = await (await getUsersCollection()).findOne({ username: normalized });
  if (!user || user.status !== "active") return null;
  return (await verifyPassword(password, user.passwordHash)) ? toSessionUser(user) : null;
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${userId}.${expires}`))) return null;
  if (!(Number(expires) > Date.now())) return null;
  return userId;
}

/**
 * Returns the logged-in user, re-reading operator accounts from MongoDB on every call
 * so role changes, disabling and deletion take effect immediately.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  if (userId === BUILT_IN_ID) return builtInUser();
  try {
    const user = await findActiveUserById(userId);
    return user ? toSessionUser(user) : null;
  } catch (error) {
    console.error("Session lookup failed", error);
    return null;
  }
}

/** Returns the session only if this user may manage team members (super admin or admin). */
export async function getTeamManager(): Promise<SessionUser | null> {
  const session = await getSession();
  return session && canManageTeam(session.role) ? session : null;
}
