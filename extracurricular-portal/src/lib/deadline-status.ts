export type DeadlineStatus = {
  label: string;
  tone: "open" | "closing-soon" | "closed" | "not-open";
};

export function deadlineStatus(opensOn: Date | null, deadline: Date, now: Date = new Date()): DeadlineStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const opensDay = opensOn ? new Date(opensOn.getFullYear(), opensOn.getMonth(), opensOn.getDate()) : null;

  if (opensDay && opensDay.getTime() > today.getTime()) {
    return { label: `Opens ${opensDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, tone: "not-open" };
  }

  const daysLeft = Math.round((deadlineDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Registration closed", tone: "closed" };
  if (daysLeft === 0) return { label: "Closes today", tone: "closing-soon" };
  if (daysLeft <= 5) return { label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: "closing-soon" };
  return { label: `${daysLeft} days left`, tone: "open" };
}

export const DEADLINE_TONE_CLASSES: Record<DeadlineStatus["tone"], string> = {
  open: "bg-emerald-50 text-emerald-700",
  "closing-soon": "bg-amber-50 text-amber-700",
  closed: "bg-zinc-100 text-zinc-500",
  "not-open": "bg-sky-50 text-sky-700",
};
