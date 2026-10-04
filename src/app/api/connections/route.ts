import { randomUUID } from "node:crypto";
import { getConnectionsCollection } from "@/lib/connections";
import { COLLECTIONS } from "@/lib/db-schema";
import { getDb } from "@/lib/mongodb";
import { bdOfficeRoster } from "../../bd-geo";

const rosterNames = new Set(bdOfficeRoster.map((office) => office.name));

// Public: an office clicked the WebRTC join link of a live event - start its connection timer
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventTitle = typeof body?.eventTitle === "string" ? body.eventTitle.trim() : "";
  const office = typeof body?.office === "string" ? body.office.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!eventTitle || !office) return Response.json({ error: "সভা ও অফিস আবশ্যক" }, { status: 400 });
  if (!rosterNames.has(office)) return Response.json({ error: "তালিকা থেকে অফিস নির্বাচন করুন" }, { status: 400 });

  try {
    // Only live events can be joined
    const event = await (await getDb()).collection(COLLECTIONS.events).findOne({ title: eventTitle, tone: "live" }, { projection: { _id: 1 } });
    if (!event) return Response.json({ error: "এই সভাটি এখন লাইভ নয়" }, { status: 409 });
    const joinedAt = new Date();
    const id = randomUUID();
    await (await getConnectionsCollection()).insertOne({ id, eventTitle, office, name, joinedAt, leftAt: null, durationSec: null });
    return Response.json({ id, joinedAt: joinedAt.getTime() }, { status: 201 });
  } catch (error) {
    console.error("POST /api/connections failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
