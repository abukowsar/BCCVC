import { cookies } from "next/headers";
import { authenticate, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "অবৈধ অনুরোধ" }, { status: 400 });
  }
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return Response.json({ error: "ব্যবহারকারী নাম ও পাসওয়ার্ড দিন" }, { status: 400 });
  }

  let user;
  try {
    user = await authenticate(username, password);
  } catch (error) {
    console.error("Login failed", error);
    return Response.json({ error: "ডাটাবেসের সাথে সংযোগ করা যায়নি, পরে আবার চেষ্টা করুন" }, { status: 503 });
  }
  if (!user) return Response.json({ error: "ব্যবহারকারী নাম বা পাসওয়ার্ড সঠিক নয়" }, { status: 401 });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ ok: true });
}
