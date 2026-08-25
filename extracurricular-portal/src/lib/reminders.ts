// Pure date-math for the three reminder types. Kept separate from any DB /
// email code so it's trivial to unit-test and reason about.
//
// Rules (per the spec): for an activity whose registration opens on
// `opensOn` and closes on `deadline`,
//   - T_MINUS_5:    5 days before the deadline
//   - MIDPOINT:     halfway between opensOn and deadline
//   - DEADLINE_DAY: the deadline itself
//
// If `opensOn` is missing (some activities only ever state a deadline), the
// midpoint reminder is skipped entirely - there's no honest "halfway" point
// to compute. If the open-to-deadline window is under 2 days, midpoint is
// also skipped since it would collide with T-5 or opensOn itself and just
// spam the student twice on the same day.

import { ReminderType } from "@prisma/client";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function computeReminderDates(
  opensOn: Date | null,
  deadline: Date
): Partial<Record<ReminderType, Date>> {
  const dates: Partial<Record<ReminderType, Date>> = {};

  dates.DEADLINE_DAY = startOfDay(deadline);
  dates.T_MINUS_5 = startOfDay(addDays(deadline, -5));

  if (opensOn) {
    const windowMs = startOfDay(deadline).getTime() - startOfDay(opensOn).getTime();
    const windowDays = windowMs / (1000 * 60 * 60 * 24);
    if (windowDays >= 2) {
      const midpointMs = startOfDay(opensOn).getTime() + windowMs / 2;
      const midpoint = startOfDay(new Date(midpointMs));
      // Don't fire a midpoint reminder that lands on the same day as T-5 or
      // the deadline itself - that's not a distinct "halfway" nudge.
      if (!isSameDay(midpoint, dates.T_MINUS_5) && !isSameDay(midpoint, dates.DEADLINE_DAY)) {
        dates.MIDPOINT = midpoint;
      }
    }
  }

  return dates;
}

// Which reminder type(s), if any, should fire today for this activity.
export function reminderTypesDueOn(
  today: Date,
  opensOn: Date | null,
  deadline: Date
): ReminderType[] {
  const dates = computeReminderDates(opensOn, deadline);
  return (Object.keys(dates) as ReminderType[]).filter((type) =>
    isSameDay(dates[type] as Date, today)
  );
}
