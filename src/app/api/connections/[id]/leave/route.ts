import { getConnectionsCollection } from "@/lib/connections";

const ID_PATTERN = /^[0-9a-f-]{36}$/;

// Public (the random id acts as the key): the office disconnected - stop its timer.
// Admins also use this to close connections that were never disconnected.
export async function POST(_request: Request, ctx: RouteContext<"/api/connections/[id]/leave">) {
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const collection = await getConnectionsCollection();
    const connection = await collection.findOne({ id });
    if (!connection) return Response.json({ error: "Not found" }, { status: 404 });
    if (connection.leftAt) return Response.json({ durationSec: connection.durationSec, alreadyClosed: true });
    const leftAt = new Date();
    const durationSec = Math.max(0, Math.round((leftAt.getTime() - connection.joinedAt.getTime()) / 1000));
    // Only the first disconnect counts
    await collection.updateOne({ id, leftAt: null }, { $set: { leftAt, durationSec } });
    return Response.json({ durationSec });
  } catch (error) {
    console.error("POST /api/connections/leave failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
