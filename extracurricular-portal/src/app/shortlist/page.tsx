import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityCard } from "@/components/ActivityCard";

export default async function ShortlistPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const shortlist = await prisma.shortlist.findMany({
    where: { studentId: session.user.id },
    include: { activity: { include: { cluster: true } } },
    orderBy: { activity: { registrationDeadline: "asc" } },
  });

  return (
    <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My shortlist</h1>
          <p className="text-sm text-muted mt-1">
            {shortlist.length} {shortlist.length === 1 ? "activity" : "activities"} saved for later
          </p>
        </div>
        {shortlist.length > 0 && (
          <a
            href="/api/export/shortlist"
            className="inline-flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors self-start"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v13m0 0-4-4m4 4 4-4M4 21h16" />
            </svg>
            Export to Excel
          </a>
        )}
      </div>

      {shortlist.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-20 text-center text-muted">
          Nothing shortlisted yet — browse activities and tap the bookmark icon to save them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortlist.map((s) => (
            <ActivityCard key={s.activityId} activity={s.activity} shortlisted />
          ))}
        </div>
      )}
    </div>
  );
}
