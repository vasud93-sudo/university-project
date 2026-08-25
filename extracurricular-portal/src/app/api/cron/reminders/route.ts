import { NextRequest, NextResponse } from "next/server";
import { runReminderPass } from "@/lib/reminder-service";

// Hit daily by Vercel Cron (see vercel.json) or any external scheduler.
// Protected by a shared secret so it can't be triggered by randoms hitting
// the URL - Vercel Cron sends it automatically as a Bearer token.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await runReminderPass();
  const totalSent = results.reduce((sum, r) => sum + r.sentCount, 0);
  return NextResponse.json({ ok: true, totalSent, results });
}
