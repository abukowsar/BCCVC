import { MongoServerError, ObjectId } from "mongodb";
import { getTeamManager } from "@/lib/auth";
import { getUsersCollection, hashPassword, MIN_PASSWORD_LENGTH, toTeamMember, USERNAME_PATTERN } from "@/lib/users";
import { isRole, manageableRoles, roleLabel } from "../../admin/session-types";

// Super admins and admins: list team accounts
export async function GET() {
  if (!(await getTeamManager())) return Response.json({ error: "শুধু সুপার অ্যাডমিন ও অ্যাডমিন এই তালিকা দেখতে পারেন" }, { status: 403 });
  try {
    const users = await (await getUsersCollection()).find().sort({ createdAt: 1 }).toArray();
    return Response.json({ users: users.map(toTeamMember) });
  } catch (error) {
    console.error("GET /api/users failed", error);
    return Response.json({ error: "ডাটাবেস সংযোগ পাওয়া যায়নি" }, { status: 503 });
  }
}

// Create an account with a starting password; super admins may create any role, admins only operators
export async function POST(request: Request) {
  const actor = await getTeamManager();
  if (!actor) return Response.json({ error: "শুধু সুপার অ্যাডমিন ও অ্যাডমিন নতুন সদস্য যোগ করতে পারেন" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;

  if (!name) return Response.json({ error: "নাম আবশ্যক" }, { status: 400 });
  if (!USERNAME_PATTERN.test(username)) return Response.json({ error: "ব্যবহারকারী নাম/ইমেইল ৩-৬৪ অক্ষরের হতে হবে (a-z, 0-9, . _ @ -)" }, { status: 400 });
  if (username === process.env.ADMIN_USERNAME?.toLowerCase()) return Response.json({ error: "এই ব্যবহারকারী নামটি সংরক্ষিত" }, { status: 409 });
  if (password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` }, { status: 400 });
  if (!isRole(role)) return Response.json({ error: "অবৈধ ভূমিকা" }, { status: 400 });
  if (!manageableRoles(actor.role).includes(role)) return Response.json({ error: `আপনি ${roleLabel(role)} যোগ করতে পারবেন না` }, { status: 403 });

  const now = new Date();
  const doc = { _id: new ObjectId(), username, name, role, status: "active" as const, passwordHash: await hashPassword(password), createdAt: now, updatedAt: now };
  try {
    await (await getUsersCollection()).insertOne(doc);
    return Response.json({ user: toTeamMember(doc) }, { status: 201 });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return Response.json({ error: "এই ব্যবহারকারী নামে ইতিমধ্যে একজন সদস্য আছেন" }, { status: 409 });
    console.error("POST /api/users failed", error);
    return Response.json({ error: "ডাটাবেস সংযোগ পাওয়া যায়নি" }, { status: 503 });
  }
}
