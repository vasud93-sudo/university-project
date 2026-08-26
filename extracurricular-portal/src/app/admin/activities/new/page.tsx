import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/BackLink";
import { ActivityForm } from "../ActivityForm";

export default async function NewActivityPage() {
  const clusters = await prisma.cluster.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-8 flex-1">
      <BackLink href="/admin/activities" label="Back to activities" />
      <h1 className="text-2xl font-semibold tracking-tight mb-1">New activity</h1>
      <p className="text-sm text-muted mb-8">This won&apos;t be visible to students until you publish it.</p>
      <ActivityForm clusters={clusters} />
    </div>
  );
}
