import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { activityInputSchema } from "@/lib/activity-schema";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = activityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.minGrade > parsed.data.maxGrade) {
    return NextResponse.json({ error: "minGrade cannot be greater than maxGrade" }, { status: 400 });
  }

  await prisma.activity.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Manually cascade the join-table rows so this stays safe under SQLite's
  // relation-mode without relying on ON DELETE CASCADE (Prisma defaults to
  // "restrict" here in relationMode "prisma", used for the dev SQLite db).
  await prisma.$transaction([
    prisma.reminderLog.deleteMany({ where: { activityId: id } }),
    prisma.activityClick.deleteMany({ where: { activityId: id } }),
    prisma.registrationSelfReport.deleteMany({ where: { activityId: id } }),
    prisma.shortlist.deleteMany({ where: { activityId: id } }),
    prisma.bulkSendRecipient.deleteMany({ where: { bulkSend: { activityId: id } } }),
    prisma.bulkSend.deleteMany({ where: { activityId: id } }),
    prisma.activity.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
