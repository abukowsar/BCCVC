import { getSession } from "@/lib/auth";
import { buildReport } from "@/lib/connections";

// Logged-in users: operations report built live from events and connection times
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ value: await buildReport() });
  } catch (error) {
    console.error("GET /api/reports failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
