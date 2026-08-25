import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId } = await req.json();
  if (typeof activityId !== "string") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await prisma.registrationSelfReport.upsert({
    where: { activityId_studentId: { activityId, studentId: user.id } },
    create: { activityId, studentId: user.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
