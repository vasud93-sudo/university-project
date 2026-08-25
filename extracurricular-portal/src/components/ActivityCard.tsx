import Link from "next/link";
import { clusterColor } from "@/lib/cluster-colors";
import { deadlineStatus, DEADLINE_TONE_CLASSES } from "@/lib/deadline-status";
import { ShortlistButton } from "@/components/ShortlistButton";

export type ActivityCardData = {
  id: string;
  title: string;
  summary: string;
  organizer: string | null;
  fee: string | null;
  minGrade: number;
  maxGrade: number;
  registrationOpensOn: Date | null;
  registrationDeadline: Date;
  cluster: { name: string; colorTag: string };
};

export function ActivityCard({ activity, shortlisted }: { activity: ActivityCardData; shortlisted?: boolean }) {
  const color = clusterColor(activity.cluster.colorTag);
  const status = deadlineStatus(activity.registrationOpensOn, activity.registrationDeadline);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 hover:shadow-lg hover:shadow-black/[.04] hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color.bg} ${color.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
          {activity.cluster.name}
        </span>
        {shortlisted !== undefined && <ShortlistButton activityId={activity.id} initialShortlisted={shortlisted} />}
      </div>

      <Link href={`/activity/${activity.id}`} className="flex-1">
        <h3 className="font-semibold text-[15px] leading-snug mb-1.5 group-hover:text-primary transition-colors">
          {activity.title}
        </h3>
        <p className="text-sm text-muted line-clamp-2 mb-4">{activity.summary}</p>
      </Link>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
        <span className="text-xs text-muted">
          Grades {activity.minGrade}–{activity.maxGrade}
          {activity.fee && <> · {activity.fee}</>}
        </span>
        <span className={`text-xs font-medium rounded-full px-2 py-1 ${DEADLINE_TONE_CLASSES[status.tone]}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}
