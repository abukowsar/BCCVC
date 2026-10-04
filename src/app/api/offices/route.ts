import { getSession } from "@/lib/auth";
import { COLLECTIONS } from "@/lib/db-schema";
import { getDb } from "@/lib/mongodb";
import { defaultOfficeLists, officeListKey, type OfficeCategory, type OfficeLists } from "../../gov-offices";

type OfficeDoc = { name: string; category: OfficeCategory; order: number; active: boolean };

// Logged-in users: organizer and partner office choices from the `offices` collection
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const docs = await (await getDb()).collection<OfficeDoc>(COLLECTIONS.offices).find({ active: true }).sort({ category: 1, order: 1 }).toArray();
    // Not seeded yet - fall back to the built-in lists
    if (docs.length === 0) return Response.json({ value: defaultOfficeLists });
    const lists: OfficeLists = { ministries: [], divisions: [], agencies: [], partners: [] };
    for (const doc of docs) lists[officeListKey[doc.category]]?.push(doc.name);
    return Response.json({ value: lists });
  } catch (error) {
    console.error("GET /api/offices failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
