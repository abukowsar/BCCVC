// Shared by server routes and client components - keep free of server-only imports

export type Role = "super-admin" | "admin" | "operator";
export type UserStatus = "active" | "disabled";

export type SessionUser = { id: string; username: string; name: string; role: Role; builtIn: boolean };

export type TeamMember = SessionUser & { status: UserStatus; createdAt: number };

export const ROLES: Role[] = ["operator", "admin", "super-admin"];

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

export const roleLabel = (role: Role) => role === "super-admin" ? "সুপার অ্যাডমিন" : role === "admin" ? "অ্যাডমিন" : "অপারেটর";

/** Roles an actor may create, edit or delete: super admins manage everyone, admins manage operators. */
export function manageableRoles(actor: Role): Role[] {
  if (actor === "super-admin") return ROLES;
  if (actor === "admin") return ["operator"];
  return [];
}

export const canManageTeam = (actor: Role) => manageableRoles(actor).length > 0;
