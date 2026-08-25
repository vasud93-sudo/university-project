import { prisma } from "@/lib/prisma";

export type EngagementRow = {
  activityId: string;
  activityTitle: string;
  cluster: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  grade: number | null;
  clicked: boolean;
  clickCount: number;
  lastClickedAt: Date | null;
  selfReportedRegistered: boolean;
  selfReportedAt: Date | null;
};

/** One row per (activity, student) who either clicked the link or self-reported registering - not a full cross join. */
export async function getEngagementRows(activityId?: string): Promise<EngagementRow[]> {
  const where = activityId ? { activityId } : {};

  const [clicks, selfReports] = await Promise.all([
    prisma.activityClick.findMany({
      where,
      include: { activity: { include: { cluster: true } }, student: true },
    }),
    prisma.registrationSelfReport.findMany({
      where,
      include: { activity: { include: { cluster: true } }, student: true },
    }),
  ]);

  const key = (activityId: string, studentId: string) => `${activityId}::${studentId}`;
  const rows = new Map<string, EngagementRow>();

  for (const c of clicks) {
    const k = key(c.activityId, c.studentId);
    const existing = rows.get(k);
    if (existing) {
      existing.clickCount++;
      if (!existing.lastClickedAt || c.clickedAt > existing.lastClickedAt) existing.lastClickedAt = c.clickedAt;
      existing.clicked = true;
    } else {
      rows.set(k, {
        activityId: c.activityId,
        activityTitle: c.activity.title,
        cluster: c.activity.cluster.name,
        studentId: c.studentId,
        studentName: c.student.name ?? c.student.email,
        studentEmail: c.student.email,
        grade: c.student.grade,
        clicked: true,
        clickCount: 1,
        lastClickedAt: c.clickedAt,
        selfReportedRegistered: false,
        selfReportedAt: null,
      });
    }
  }

  for (const r of selfReports) {
    const k = key(r.activityId, r.studentId);
    const existing = rows.get(k);
    if (existing) {
      existing.selfReportedRegistered = true;
      existing.selfReportedAt = r.reportedAt;
    } else {
      rows.set(k, {
        activityId: r.activityId,
        activityTitle: r.activity.title,
        cluster: r.activity.cluster.name,
        studentId: r.studentId,
        studentName: r.student.name ?? r.student.email,
        studentEmail: r.student.email,
        grade: r.student.grade,
        clicked: false,
        clickCount: 0,
        lastClickedAt: null,
        selfReportedRegistered: true,
        selfReportedAt: r.reportedAt,
      });
    }
  }

  return [...rows.values()].sort((a, b) => a.activityTitle.localeCompare(b.activityTitle) || a.studentName.localeCompare(b.studentName));
}
