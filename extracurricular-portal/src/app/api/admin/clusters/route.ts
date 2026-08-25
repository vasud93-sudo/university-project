import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const COLOR_ROTATION = ["violet", "emerald", "amber", "sky", "rose", "indigo", "teal", "fuchsia"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clusters = await prisma.cluster.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ clusters });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const count = await prisma.cluster.count();
  const cluster = await prisma.cluster.create({
    data: { name: name.trim(), colorTag: COLOR_ROTATION[count % COLOR_ROTATION.length] },
  });

  return NextResponse.json({ ok: true, cluster });
}
