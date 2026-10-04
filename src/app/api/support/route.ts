import { MongoServerError } from "mongodb";
import { getSession } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/db-schema";
import { getDb } from "@/lib/mongodb";
import { MAX_SUPPORT_MESSAGES, type SupportMessage } from "../../support-store";

type SupportDoc = SupportMessage & { resolvedAt?: Date; resolvedBy?: string };

const LIMITS = { name: 100, office: 200, message: 2000, reply: 2000 };

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function getSupportCollection() {
  return (await getDb()).collection<SupportDoc>(COLLECTIONS.supportMessages);
}

// Logged-in users only: messages include the sender's name and office. Every message is kept; the newest are returned.
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const messages = await (await getSupportCollection())
      .find({}, { projection: { _id: 0, resolvedAt: 0, resolvedBy: 0 } })
      .sort({ submittedAt: -1 })
      .limit(MAX_SUPPORT_MESSAGES)
      .toArray();
    return Response.json({ value: messages });
  } catch (error) {
    console.error("GET /api/support failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

// Public: anyone on the public/event board can send a support request
export async function POST(request: Request) {
  const body = await readJson(request);
  const name = cleanText(body?.name, LIMITS.name);
  const office = cleanText(body?.office, LIMITS.office);
  const message = cleanText(body?.message, LIMITS.message);
  if (!name || !message) return Response.json({ error: "নাম ও বার্তা আবশ্যক" }, { status: 400 });

  const submittedAt = Date.now();
  try {
    const collection = await getSupportCollection();
    // `id` is unique; two messages in the same millisecond take the next free number
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await collection.insertOne({ id: submittedAt + attempt, name, office, message, status: "open", reply: "", submittedAt });
        return Response.json({ ok: true });
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
      }
    }
    return Response.json({ error: "আবার চেষ্টা করুন" }, { status: 409 });
  } catch (error) {
    console.error("POST /api/support failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

// Logged-in users only: mark a message resolved with a reply
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const id = body?.id;
  const reply = cleanText(body?.reply, LIMITS.reply);
  if (typeof id !== "number" || !reply) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const result = await (await getSupportCollection()).updateOne(
      { id },
      { $set: { status: "resolved", reply, resolvedAt: new Date(), resolvedBy: session.username } },
    );
    if (result.matchedCount === 0) return Response.json({ error: "Message not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/support failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
