import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { clusterColor } from "@/lib/cluster-colors";

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-zinc-100 text-zinc-500",
};

export default async function AdminActivitiesPage() {
  const activities = await prisma.activity.findMany({
    include: { cluster: true, _count: { select: { clicks: true, selfReports: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-sm text-muted mt-1">{activities.length} total, across all statuses</p>
        </div>
        <Link
          href="/admin/activities/new"
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          + New activity
        </Link>
      </div>

      <div className="border border-border rounded-2xl overflow-hidden bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Grades</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Engagement</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => {
              const color = clusterColor(a.cluster.colorTag);
              return (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-black/[.015]">
                  <td className="px-4 py-3 font-medium max-w-xs">
                    <Link href={`/admin/activities/${a.id}/edit`} className="hover:text-primary">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${color.bg} ${color.text}`}>
                      {a.cluster.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {a.minGrade}–{a.maxGrade}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {a.registrationDeadline.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {a._count.clicks} clicks · {a._count.selfReports} registered
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/activities/${a.id}/edit`} className="text-primary text-xs font-medium hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {activities.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-muted">
                  No activities yet. Create your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
