import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClickSource } from "@prisma/client";

const SOURCE_MAP: Record<string, ClickSource> = {
  reminder: "REMINDER_EMAIL",
  bulk: "BULK_EMAIL",
  browse: "BROWSE",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const src = req.nextUrl.searchParams.get("src") ?? "browse";

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) return NextResponse.redirect(new URL("/browse", req.url));

  const session = await auth();
  if (!session?.user) {
    // Preserve the destination so the click is still tracked once they sign in.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  await prisma.activityClick.create({
    data: {
      activityId: activity.id,
      studentId: session.user.id,
      source: SOURCE_MAP[src] ?? "BROWSE",
    },
  });

  // Send them straight through to the actual (third-party) registration
  // page. The "have you registered?" confirmation lives back on our own
  // activity detail page, as an always-available self-report toggle - it
  // doesn't depend on the student returning via this route.
  return NextResponse.redirect(activity.link);
}
