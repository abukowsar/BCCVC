import { ObjectId } from "mongodb";
import { getTeamManager } from "@/lib/auth";
import { getUsersCollection, hashPassword, MIN_PASSWORD_LENGTH, toTeamMember, type UserDoc } from "@/lib/users";
import { isRole, manageableRoles, roleLabel } from "../../../admin/session-types";

/** Loads the target account and checks the logged-in user may manage it (admins: operators only). */
async function resolveTarget(ctx: RouteContext<"/api/users/[id]">) {
  const actor = await getTeamManager();
  if (!actor) return { response: Response.json({ error: "শুধু সুপার অ্যাডমিন ও অ্যাডমিন সদস্য ব্যবস্থাপনা করতে পারেন" }, { status: 403 }) };
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return { response: Response.json({ error: "সদস্য পাওয়া যায়নি" }, { status: 404 }) };
  if (id === actor.id) return { response: Response.json({ error: "নিজের অ্যাক্সেস পরিবর্তন করা যায় না" }, { status: 400 }) };
  const _id = new ObjectId(id);
  let target: UserDoc | null;
  try {
    target = await (await getUsersCollection()).findOne({ _id });
  } catch (error) {
    console.error("User lookup failed", error);
    return { response: Response.json({ error: "ডাটাবেস সংযোগ পাওয়া যায়নি" }, { status: 503 }) };
  }
  if (!target) return { response: Response.json({ error: "সদস্য পাওয়া যায়নি" }, { status: 404 }) };
  const allowed = manageableRoles(actor.role);
  if (!allowed.includes(target.role)) return { response: Response.json({ error: `আপনি ${roleLabel(target.role)} সম্পাদনা করতে পারবেন না` }, { status: 403 }) };
  return { id: _id, allowed };
}

// Change role, enable/disable, or reset password
export async function PATCH(request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const target = await resolveTarget(ctx);
  if (target.response) return target.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const update: Partial<UserDoc> = {};
  if (body?.role !== undefined) {
    if (!isRole(body.role)) return Response.json({ error: "অবৈধ ভূমিকা" }, { status: 400 });
    if (!target.allowed.includes(body.role)) return Response.json({ error: `আপনি কাউকে ${roleLabel(body.role)} করতে পারবেন না` }, { status: 403 });
    update.role = body.role;
  }
  if (body?.status !== undefined) {
    if (body.status !== "active" && body.status !== "disabled") return Response.json({ error: "অবৈধ অবস্থা" }, { status: 400 });
    update.status = body.status;
  }
  if (body?.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` }, { status: 400 });
    update.passwordHash = await hashPassword(body.password);
  }
  if (Object.keys(update).length === 0) return Response.json({ error: "কোনো পরিবর্তন নেই" }, { status: 400 });

  try {
    const user = await (await getUsersCollection()).findOneAndUpdate({ _id: target.id }, { $set: { ...update, updatedAt: new Date() } }, { returnDocument: "after" });
    if (!user) return Response.json({ error: "সদস্য পাওয়া যায়নি" }, { status: 404 });
    return Response.json({ user: toTeamMember(user) });
  } catch (error) {
    console.error("PATCH /api/users failed", error);
    return Response.json({ error: "ডাটাবেস সংযোগ পাওয়া যায়নি" }, { status: 503 });
  }
}

// Delete an account
export async function DELETE(_request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const target = await resolveTarget(ctx);
  if (target.response) return target.response;
  try {
    const result = await (await getUsersCollection()).deleteOne({ _id: target.id });
    if (result.deletedCount === 0) return Response.json({ error: "সদস্য পাওয়া যায়নি" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/users failed", error);
    return Response.json({ error: "ডাটাবেস সংযোগ পাওয়া যায়নি" }, { status: 503 });
  }
}
