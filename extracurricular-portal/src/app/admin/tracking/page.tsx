import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEngagementRows } from "@/lib/tracking";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ activityId?: string }>;
}) {
  const { activityId } = await searchParams;

  const [activities, rows] = await Promise.all([
    prisma.activity.findMany({ orderBy: { title: "asc" } }),
    getEngagementRows(activityId),
  ]);

  const totalClicks = rows.reduce((sum, r) => sum + r.clickCount, 0);
  const totalRegistered = rows.filter((r) => r.selfReportedRegistered).length;

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engagement tracking</h1>
          <p className="text-sm text-muted mt-1">Who clicked which activity&apos;s link, and who&apos;s marked themselves registered.</p>
        </div>
        <a
          href={`/api/admin/tracking/export${activityId ? `?activityId=${activityId}` : ""}`}
          className="inline-flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors self-start"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v13m0 0-4-4m4 4 4-4M4 21h16" />
          </svg>
          Export to Excel
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatTile label="Students engaged" value={new Set(rows.map((r) => r.studentId)).size} />
        <StatTile label="Total clicks" value={totalClicks} />
        <StatTile label="Self-reported registered" value={totalRegistered} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/admin/tracking"
          className={`text-xs font-medium rounded-full px-3 py-1.5 border ${
            !activityId ? "bg-foreground text-white border-foreground" : "border-border text-muted"
          }`}
        >
          All activities
        </Link>
        {activities.map((a) => (
          <Link
            key={a.id}
            href={`/admin/tracking?activityId=${a.id}`}
            className={`text-xs font-medium rounded-full px-3 py-1.5 border ${
              activityId === a.id ? "bg-foreground text-white border-foreground" : "border-border text-muted"
            }`}
          >
            {a.title}
          </Link>
        ))}
      </div>

      <div className="border border-border rounded-2xl overflow-hidden bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Student</th>
              {!activityId && <th className="px-4 py-3 font-medium">Activity</th>}
              <th className="px-4 py-3 font-medium">Grade</th>
              <th className="px-4 py-3 font-medium">Clicked?</th>
              <th className="px-4 py-3 font-medium">Registered (self-reported)?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.activityId}-${r.studentId}`} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.studentName}</p>
                  <p className="text-xs text-muted">{r.studentEmail}</p>
                </td>
                {!activityId && <td className="px-4 py-3 text-muted">{r.activityTitle}</td>}
                <td className="px-4 py-3 text-muted">{r.grade ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.clicked ? (
                    <span className="rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 text-xs font-medium">
                      {r.clickCount}× · last {r.lastClickedAt?.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                    </span>
                  ) : (
                    <span className="text-muted text-xs">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.selfReportedRegistered ? (
                    <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                      Yes · {r.selfReportedAt?.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                    </span>
                  ) : (
                    <span className="text-muted text-xs">Not yet</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-muted">
                  No engagement recorded yet for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-2xl bg-surface p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
