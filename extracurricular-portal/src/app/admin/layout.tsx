import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  return <div className="flex-1 flex flex-col bg-background">{children}</div>;
}
