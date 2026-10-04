import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SessionProvider } from "./session-context";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();
  if (!user) redirect("/login");
  return <SessionProvider user={user}>{children}</SessionProvider>;
}
