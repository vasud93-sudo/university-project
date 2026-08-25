import { ReminderType } from "@prisma/client";

type ActivityForEmail = {
  id: string;
  title: string;
  summary: string;
  fee: string | null;
  registrationDeadline: Date;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

function daysBetween(a: Date, b: Date): number {
  const ms = new Date(b.toDateString()).getTime() - new Date(a.toDateString()).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const REMINDER_HEADLINES: Record<ReminderType, (deadline: Date, today: Date) => string> = {
  T_MINUS_5: (deadline, today) => `${daysBetween(today, deadline)} days left to register`,
  MIDPOINT: () => "Registrations are open — don't miss the window",
  DEADLINE_DAY: () => "Last day to register — closes today",
};

export function buildReminderEmail(
  activity: ActivityForEmail,
  type: ReminderType,
  portalUrl: string,
  today: Date = new Date()
) {
  const headline = REMINDER_HEADLINES[type](activity.registrationDeadline, today);
  const link = `${portalUrl}/go/${activity.id}`;

  const subject = `${headline}: ${activity.title}`;
  const text = [
    headline,
    "",
    activity.title,
    activity.summary,
    "",
    `Registration deadline: ${fmtDate(activity.registrationDeadline)}`,
    activity.fee ? `Fee: ${activity.fee}` : null,
    "",
    `View details and register: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <p style="display:inline-block;background:#eef2ff;color:#4338ca;font-weight:600;font-size:13px;
                padding:4px 10px;border-radius:999px;margin-bottom:16px">${headline}</p>
      <h2 style="margin:0 0 8px;font-size:20px">${activity.title}</h2>
      <p style="margin:0 0 16px;color:#4b5563;line-height:1.5">${activity.summary}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px">Registration deadline</td>
          <td style="padding:6px 0;font-weight:600;text-align:right">${fmtDate(activity.registrationDeadline)}</td>
        </tr>
        ${
          activity.fee
            ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Fee</td>
                 <td style="padding:6px 0;font-weight:600;text-align:right">${activity.fee}</td></tr>`
            : ""
        }
      </table>
      <a href="${link}" style="display:inline-block;background:#4338ca;color:#fff;text-decoration:none;
                                padding:10px 20px;border-radius:8px;font-weight:600">View details & register</a>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">
        Sent by the Career Counselling team via the Extracurricular Activities portal.
      </p>
    </div>`;

  return { subject, text, html };
}

export function buildBulkSendEmail(
  activity: ActivityForEmail,
  portalUrl: string,
  note: string | null
) {
  const link = `${portalUrl}/go/${activity.id}`;
  const subject = `Opportunity for you: ${activity.title}`;
  const text = [
    note,
    "",
    activity.title,
    activity.summary,
    "",
    `Registration deadline: ${fmtDate(activity.registrationDeadline)}`,
    activity.fee ? `Fee: ${activity.fee}` : null,
    "",
    `View details and register: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      ${note ? `<p style="margin:0 0 16px;color:#374151;line-height:1.5">${note}</p>` : ""}
      <h2 style="margin:0 0 8px;font-size:20px">${activity.title}</h2>
      <p style="margin:0 0 16px;color:#4b5563;line-height:1.5">${activity.summary}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px">Registration deadline</td>
          <td style="padding:6px 0;font-weight:600;text-align:right">${fmtDate(activity.registrationDeadline)}</td>
        </tr>
      </table>
      <a href="${link}" style="display:inline-block;background:#4338ca;color:#fff;text-decoration:none;
                                padding:10px 20px;border-radius:8px;font-weight:600">View details & register</a>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">
        Sent by the Career Counselling team via the Extracurricular Activities portal.
      </p>
    </div>`;

  return { subject, text, html };
}
