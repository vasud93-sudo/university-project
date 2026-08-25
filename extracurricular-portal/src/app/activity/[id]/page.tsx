import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clusterColor } from "@/lib/cluster-colors";
import { deadlineStatus, DEADLINE_TONE_CLASSES } from "@/lib/deadline-status";
import { ShortlistButton } from "@/components/ShortlistButton";
import { SelfReportToggle } from "./SelfReportToggle";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const activity = await prisma.activity.findUnique({ where: { id }, include: { cluster: true } });
  if (!activity || (activity.status !== "PUBLISHED" && session.user.role !== "ADMIN")) notFound();

  const [shortlist, selfReport] = await Promise.all([
    prisma.shortlist.findUnique({
      where: { activityId_studentId: { activityId: id, studentId: session.user.id } },
    }),
    prisma.registrationSelfReport.findUnique({
      where: { activityId_studentId: { activityId: id, studentId: session.user.id } },
    }),
  ]);

  const color = clusterColor(activity.cluster.colorTag);
  const status = deadlineStatus(activity.registrationOpensOn, activity.registrationDeadline);

  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-8 flex-1">
      <Link href="/browse" className="text-sm text-muted hover:text-foreground inline-flex items-center gap-1 mb-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to browse
      </Link>

      <div className="flex items-start justify-between gap-4 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color.bg} ${color.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
          {activity.cluster.name}
        </span>
        <ShortlistButton activityId={activity.id} initialShortlisted={Boolean(shortlist)} />
      </div>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">{activity.title}</h1>
      {activity.organizer && <p className="text-sm text-muted mb-6">Organized by {activity.organizer}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <InfoTile label="Eligibility" value={`Grades ${activity.minGrade}–${activity.maxGrade}`} />
        <InfoTile label="Registration deadline" value={fmt(activity.registrationDeadline)} />
        <InfoTile label="Fee" value={activity.fee ?? "Not specified"} />
        <InfoTile label="Mode" value={activity.mode ?? "Not specified"} />
      </div>

      <span className={`inline-block text-sm font-medium rounded-full px-3 py-1.5 mb-8 ${DEADLINE_TONE_CLASSES[status.tone]}`}>
        {status.label}
      </span>

      <div className="prose-sm whitespace-pre-line text-[15px] leading-relaxed text-foreground/90 mb-10">
        {activity.description}
      </div>

      <div className="sticky bottom-4 sm:static bg-surface sm:bg-transparent border border-border sm:border-0 rounded-2xl sm:rounded-none p-4 sm:p-0 shadow-lg sm:shadow-none space-y-3">
        <a
          href={`/go/${activity.id}?src=browse`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-primary text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-hover transition-colors"
        >
          Go to official registration site
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </a>
        <SelfReportToggle activityId={activity.id} initialReported={Boolean(selfReport)} />
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[.02] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}
