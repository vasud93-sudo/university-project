import { prisma } from "@/lib/prisma";
import { BulkSendForm } from "./BulkSendForm";

export default async function BulkSendPage() {
  const [activities, students, recentSends] = await Promise.all([
    prisma.activity.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { role: "STUDENT" }, orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    prisma.bulkSend.findMany({
      include: { activity: true, sentBy: true, _count: { select: { recipients: true } } },
      orderBy: { sentAt: "desc" },
      take: 10,
    }),
  ]);

  const groupMap = new Map<string, string[]>();
  for (const s of students) {
    const label = `Grade ${s.grade ?? "—"}${s.section ? ` - ${s.section}` : ""}`;
    groupMap.set(label, [...(groupMap.get(label) ?? []), s.email]);
  }
  const groups = [...groupMap.entries()].map(([label, emails]) => ({ label, emails }));

  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-8 flex-1">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Bulk send</h1>
      <p className="text-sm text-muted mb-8">Push a specific activity straight to a class&apos;s inboxes, outside the normal reminder schedule.</p>

      <BulkSendForm activities={activities} groups={groups} />

      <div className="mt-12">
        <h2 className="text-sm font-semibold mb-3">Recent bulk sends</h2>
        <div className="border border-border rounded-2xl bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {recentSends.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.activity.title}</p>
                    <p className="text-xs text-muted">{b.targetLabel ?? "Custom list"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {b.sentAt.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted text-right whitespace-nowrap">
                    {b._count.recipients} recipients
                  </td>
                </tr>
              ))}
              {recentSends.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-muted text-sm">Nothing sent yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
