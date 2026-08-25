import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getMailer } from "@/lib/mailer";
import { buildBulkSendEmail } from "@/lib/email-templates";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activityId, emails, note, targetLabel } = (await req.json()) as {
    activityId: string;
    emails: string[];
    note?: string;
    targetLabel?: string;
  };

  if (!activityId || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "activityId and at least one email are required" }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const mailer = getMailer();
  const email = buildBulkSendEmail(activity, PORTAL_URL, note?.trim() || null);

  const bulkSend = await prisma.bulkSend.create({
    data: { activityId, sentById: admin.id, note: note?.trim() || null, targetLabel: targetLabel?.trim() || null },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const addr of uniqueEmails) {
    if (!EMAIL_RE.test(addr)) {
      skipped++;
      await prisma.bulkSendRecipient.create({ data: { bulkSendId: bulkSend.id, email: addr, status: "SKIPPED_NO_ACCOUNT" } });
      continue;
    }

    const student = await prisma.user.findUnique({ where: { email: addr } });
    const outcome = await mailer.send({ to: addr, subject: email.subject, html: email.html, text: email.text });

    await prisma.bulkSendRecipient.create({
      data: {
        bulkSendId: bulkSend.id,
        email: addr,
        studentId: student?.id,
        status: outcome.ok ? "SENT" : "FAILED",
      },
    });
    if (outcome.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, bulkSendId: bulkSend.id, sent, failed, skipped });
}
