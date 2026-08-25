import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { runReminderPass } from "@/lib/reminder-service";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await runReminderPass();
  return NextResponse.json({ ok: true, results });
}
