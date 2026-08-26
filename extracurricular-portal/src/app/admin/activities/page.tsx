import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { clusterColor } from "@/lib/cluster-colors";

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-zinc-100 text-zinc-500",
};

const STATUS_TABS = ["All", "PUBLISHED", "DRAFT", "ARCHIVED"] as const;

function shortLink(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string; status?: string }>;
}) {
  const { cluster, status } = await searchParams;

  const [activities, clusters] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...(cluster ? { clusterId: cluster } : {}),
        ...(status && status !== "All" ? { status: status as "PUBLISHED" | "DRAFT" | "ARCHIVED" } : {}),
      },
      include: { cluster: true, _count: { select: { clicks: true, selfReports: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cluster.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalCount = await prisma.activity.count();

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="text-sm text-muted mt-1">
            {activities.length} of {totalCount} shown
          </p>
        </div>
        <Link
          href="/admin/activities/new"
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          + New activity
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_TABS.map((s) => {
          const active = (status ?? "All") === s;
          const params = new URLSearchParams();
          if (s !== "All") params.set("status", s);
          if (cluster) params.set("cluster", cluster);
          const href = `/admin/activities${params.toString() ? `?${params.toString()}` : ""}`;
          return (
            <Link
              key={s}
              href={href}
              className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                active ? "bg-foreground text-white border-foreground" : "border-border text-muted hover:border-foreground/30"
              }`}
            >
              {s === "All" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/admin/activities${status && status !== "All" ? `?status=${status}` : ""}`}
          className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
            !cluster ? "bg-foreground text-white border-foreground" : "border-border text-muted hover:border-foreground/30"
          }`}
        >
          All categories
        </Link>
        {clusters.map((c) => {
          const color = clusterColor(c.colorTag);
          const active = cluster === c.id;
          const params = new URLSearchParams();
          params.set("cluster", c.id);
          if (status && status !== "All") params.set("status", status);
          return (
            <Link
              key={c.id}
              href={`/admin/activities?${params.toString()}`}
              className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                active ? `${color.bg} ${color.text} border-transparent` : "border-border text-muted hover:border-foreground/30"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
              {c.name}
            </Link>
          );
        })}
      </div>

      <div className="border border-border rounded-2xl overflow-hidden bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-border">
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Grades</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Registration link</th>
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
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {a.minGrade}–{a.maxGrade}
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {a.registrationDeadline.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline whitespace-nowrap"
                      title={a.link}
                    >
                      {shortLink(a.link)}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M7 17 17 7M7 7h10v10" />
                      </svg>
                    </a>
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
                <td colSpan={8} className="px-4 py-16 text-center text-muted">
                  No activities match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
