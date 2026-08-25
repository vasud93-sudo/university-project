import { prisma } from "@/lib/prisma";
import { RosterUploadForm } from "./RosterUploadForm";

export default async function RosterPage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
  });

  const grouped = new Map<string, typeof students>();
  for (const s of students) {
    const key = `Grade ${s.grade ?? "—"}${s.section ? ` - ${s.section}` : ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), s]);
  }

  return (
    <div className="mx-auto max-w-5xl w-full px-6 py-8 flex-1">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Student roster</h1>
      <p className="text-sm text-muted mb-6">{students.length} students on file, used for grade targeting and bulk sends.</p>

      <div className="mb-8">
        <RosterUploadForm />
      </div>

      <div className="space-y-6">
        {[...grouped.entries()].map(([label, group]) => (
          <div key={label} className="border border-border rounded-2xl bg-surface overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-black/[.015] flex items-center justify-between">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted">{group.length} students</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {group.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-muted">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {students.length === 0 && (
          <div className="border border-dashed border-border rounded-2xl py-16 text-center text-muted">
            No students uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}
