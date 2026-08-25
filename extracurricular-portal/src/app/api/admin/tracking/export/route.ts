import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { getEngagementRows } from "@/lib/tracking";
import { buildTrackingWorkbook } from "@/lib/excel";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = req.nextUrl.searchParams.get("activityId") ?? undefined;
  const rows = await getEngagementRows(activityId);
  const buffer = await buildTrackingWorkbook(rows);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="activity-engagement.xlsx"`,
    },
  });
}
