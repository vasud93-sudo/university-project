import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { activityInputSchema } from "@/lib/activity-schema";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = activityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.minGrade > parsed.data.maxGrade) {
    return NextResponse.json({ error: "minGrade cannot be greater than maxGrade" }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: { ...parsed.data, createdById: admin.id },
  });

  return NextResponse.json({ ok: true, id: activity.id });
}
