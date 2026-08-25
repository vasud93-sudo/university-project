import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildShortlistWorkbook } from "@/lib/excel";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shortlist = await prisma.shortlist.findMany({
    where: { studentId: user.id },
    include: { activity: { include: { cluster: true } } },
    orderBy: { activity: { registrationDeadline: "asc" } },
  });

  const buffer = await buildShortlistWorkbook(
    user.name ?? user.email ?? "student",
    shortlist.map((s) => ({
      title: s.activity.title,
      cluster: s.activity.cluster.name,
      organizer: s.activity.organizer,
      minGrade: s.activity.minGrade,
      maxGrade: s.activity.maxGrade,
      registrationOpensOn: s.activity.registrationOpensOn,
      registrationDeadline: s.activity.registrationDeadline,
      fee: s.activity.fee,
      mode: s.activity.mode,
      link: s.activity.link,
    }))
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="my-shortlist.xlsx"`,
    },
  });
}
