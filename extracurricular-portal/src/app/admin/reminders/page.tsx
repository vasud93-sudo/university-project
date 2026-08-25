import { previewReminderSchedule } from "@/lib/reminder-service";
import { prisma } from "@/lib/prisma";
import { isDemoMailer } from "@/lib/mailer";
import { RunNowButton } from "./RunNowButton";

const TYPE_LABEL: Record<string, string> = {
  T_MINUS_5: "5 days before deadline",
  MIDPOINT: "Halfway through registration",
  DEADLINE_DAY: "Deadline day",
};

const STATUS_STYLES: Record<string, string> = {
  past: "bg-zinc-100 text-zinc-500",
  today: "bg-amber-50 text-amber-700",
  upcoming: "bg-sky-50 text-sky-700",
};

export default async function RemindersPage() {
  const [schedule, recentLogs] = await Promise.all([
    previewReminderSchedule(),
    prisma.reminderLog.findMany({
      include: { activity: true, student: true },
      orderBy: { sentAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl w-full px-6 py-8 flex-1">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Reminders</h1>
      <p className="text-sm text-muted mb-6">
        Every published activity gets three automatic reminders: 5 days before its deadline, halfway between when
        registration opens and the deadline, and on the deadline day itself.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <p className="text-sm font-medium mb-1">
            {isDemoMailer() ? "Demo mode: emails are logged to the server console, not actually delivered." : "Live email delivery is configured."}
          </p>
          <p className="text-xs text-muted">
            A daily cron job (<code className="bg-black/[.04] px-1 rounded">/api/cron/reminders</code>) runs this
            automatically in production. Use the button to trigger today&apos;s pass manually right now.
          </p>
        </div>
        <RunNowButton />
      </div>

      <h2 className="text-sm font-semibold mb-3">Upcoming schedule</h2>
      <div className="border border-border rounded-2xl overflow-hidden bg-surface mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium">Reminder</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Recipients</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => (
              <tr key={`${s.activityId}-${s.type}`} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{s.activityTitle}</td>
                <td className="px-4 py-3 text-muted">{TYPE_LABEL[s.type]}</td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {s.date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-muted">
                  {s.recipientCount} students{s.alreadySentCount > 0 && ` (${s.alreadySentCount} already sent)`}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                </td>
              </tr>
            ))}
            {schedule.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No published activities with a deadline yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold mb-3">Recently sent</h2>
      <div className="border border-border rounded-2xl overflow-hidden bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {recentLogs.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{l.activity.title}</p>
                  <p className="text-xs text-muted">
                    {TYPE_LABEL[l.type]} → {l.student.name} ({l.student.email})
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-muted text-right whitespace-nowrap">
                  {l.sentAt.toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {recentLogs.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-muted text-sm">No reminders sent yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
