import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { ActivityForm, ActivityFormValues } from "../../ActivityForm";

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [activity, clusters] = await Promise.all([
    prisma.activity.findUnique({ where: { id } }),
    prisma.cluster.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!activity) notFound();

  const initialValues: ActivityFormValues = {
    id: activity.id,
    title: activity.title,
    organizer: activity.organizer ?? "",
    summary: activity.summary,
    description: activity.description,
    link: activity.link,
    fee: activity.fee ?? "",
    mode: activity.mode ?? "Online",
    location: activity.location ?? "",
    minGrade: activity.minGrade,
    maxGrade: activity.maxGrade,
    registrationOpensOn: toDateInput(activity.registrationOpensOn),
    registrationDeadline: toDateInput(activity.registrationDeadline),
    eventDate: toDateInput(activity.eventDate),
    status: activity.status,
    clusterId: activity.clusterId,
    sourceNote: activity.sourceNote ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-8 flex-1">
      <BackLink href="/admin/activities" label="Back to activities" />
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Edit activity</h1>
      <p className="text-sm text-muted mb-8">{activity.title}</p>
      <ActivityForm clusters={clusters} initialValues={initialValues} />
    </div>
  );
}
