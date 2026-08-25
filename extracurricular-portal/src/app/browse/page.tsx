import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityCard } from "@/components/ActivityCard";
import { FilterBar } from "./FilterBar";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string; grades?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { cluster, grades, q } = await searchParams;
  const user = session.user;

  const clusters = await prisma.cluster.findMany({ orderBy: { name: "asc" } });

  const gradeScope = grades ?? (user.grade ? "mine" : "all");
  const gradeFilter =
    gradeScope === "mine" && user.grade
      ? { minGrade: { lte: user.grade }, maxGrade: { gte: user.grade } }
      : {};

  const activities = await prisma.activity.findMany({
    where: {
      status: "PUBLISHED",
      ...gradeFilter,
      ...(cluster ? { clusterId: cluster } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { summary: { contains: q } },
              { organizer: { contains: q } },
            ],
          }
        : {}),
    },
    include: { cluster: true },
    orderBy: { registrationDeadline: "asc" },
  });

  const shortlisted = new Set(
    (await prisma.shortlist.findMany({ where: { studentId: user.id }, select: { activityId: true } })).map(
      (s) => s.activityId
    )
  );

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Browse activities</h1>
        <p className="text-sm text-muted mt-1">
          Competitions, scholarships, and enrichment programs curated by the Career Counselling team.
        </p>
      </div>

      <div className="mb-6">
        <FilterBar clusters={clusters} defaultGrade={user.grade} />
      </div>

      {activities.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-20 text-center text-muted">
          No activities match your filters right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((a) => (
            <ActivityCard key={a.id} activity={a} shortlisted={shortlisted.has(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
