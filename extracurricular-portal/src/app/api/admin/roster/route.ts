import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

// Accepts rows of { name, email, grade, section }. Upserts by email so
// re-uploading an updated roster (e.g. a corrected grade) is safe to do
// repeatedly - it never touches role, so a student manually promoted to
// ADMIN elsewhere isn't affected by a roster refresh.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = (await req.json()) as {
    rows: { name: string; email: string; grade: number; section?: string }[];
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      errors.push(`Skipped invalid email: "${row.email}"`);
      continue;
    }
    const grade = Number(row.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      errors.push(`Skipped ${email}: invalid grade "${row.grade}"`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    await prisma.user.upsert({
      where: { email },
      create: { email, name: row.name?.trim() || email, grade, section: row.section?.trim() || null, role: "STUDENT" },
      update: { name: row.name?.trim() || undefined, grade, section: row.section?.trim() || null },
    });
    if (existing) updated++;
    else created++;
  }

  return NextResponse.json({ ok: true, created, updated, errors });
}
