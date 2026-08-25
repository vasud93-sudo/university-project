import { ReminderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeReminderDates, reminderTypesDueOn } from "@/lib/reminders";
import { getMailer } from "@/lib/mailer";
import { buildReminderEmail } from "@/lib/email-templates";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:3000";

export type ReminderRunResult = {
  activityId: string;
  activityTitle: string;
  type: ReminderType;
  recipientCount: number;
  sentCount: number;
  alreadySentCount: number;
};

/**
 * Runs the reminder pass for `today`. For every published activity, works
 * out which reminder type(s) (if any) are due today, finds the students in
 * range for that activity's grades, and sends the ones who haven't already
 * gotten that specific reminder (ReminderLog is the dedupe key) - so this is
 * safe to call more than once on the same day, e.g. from a manual "send now"
 * as well as the daily cron.
 */
export async function runReminderPass(today: Date = new Date()): Promise<ReminderRunResult[]> {
  const activities = await prisma.activity.findMany({
    where: { status: "PUBLISHED" },
  });

  const mailer = getMailer();
  const results: ReminderRunResult[] = [];

  for (const activity of activities) {
    const dueTypes = reminderTypesDueOn(today, activity.registrationOpensOn, activity.registrationDeadline);
    if (dueTypes.length === 0) continue;

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        grade: { gte: activity.minGrade, lte: activity.maxGrade },
      },
    });

    for (const type of dueTypes) {
      const alreadySent = await prisma.reminderLog.findMany({
        where: { activityId: activity.id, type, studentId: { in: students.map((s) => s.id) } },
        select: { studentId: true },
      });
      const alreadySentIds = new Set(alreadySent.map((r) => r.studentId));
      const toSend = students.filter((s) => !alreadySentIds.has(s.id));

      const email = buildReminderEmail(activity, type, PORTAL_URL, today);
      let sentCount = 0;
      for (const student of toSend) {
        const outcome = await mailer.send({ to: student.email, subject: email.subject, html: email.html, text: email.text });
        if (outcome.ok) {
          await prisma.reminderLog.create({
            data: { activityId: activity.id, studentId: student.id, type },
          });
          sentCount++;
        }
      }

      results.push({
        activityId: activity.id,
        activityTitle: activity.title,
        type,
        recipientCount: students.length,
        sentCount,
        alreadySentCount: alreadySentIds.size,
      });
    }
  }

  return results;
}

export type ScheduledReminder = {
  activityId: string;
  activityTitle: string;
  type: ReminderType;
  date: Date;
  status: "past" | "today" | "upcoming";
  recipientCount: number;
  alreadySentCount: number;
};

/** Read-only projection of every reminder date for every published activity - for the admin "upcoming reminders" table. */
export async function previewReminderSchedule(today: Date = new Date()): Promise<ScheduledReminder[]> {
  const activities = await prisma.activity.findMany({ where: { status: "PUBLISHED" } });
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const schedule: ScheduledReminder[] = [];

  for (const activity of activities) {
    const dates = computeReminderDates(activity.registrationOpensOn, activity.registrationDeadline);
    const studentCount = await prisma.user.count({
      where: { role: "STUDENT", grade: { gte: activity.minGrade, lte: activity.maxGrade } },
    });

    for (const type of Object.keys(dates) as ReminderType[]) {
      const date = dates[type] as Date;
      const status = date.getTime() < todayStart.getTime() ? "past" : date.getTime() === todayStart.getTime() ? "today" : "upcoming";

      const alreadySentCount = await prisma.reminderLog.count({
        where: { activityId: activity.id, type },
      });

      schedule.push({
        activityId: activity.id,
        activityTitle: activity.title,
        type,
        date,
        status,
        recipientCount: studentCount,
        alreadySentCount,
      });
    }
  }

  return schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
}
