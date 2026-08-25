"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setSummary(null);
    const res = await fetch("/api/admin/reminders/run", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const { results } = await res.json();
      const totalSent = results.reduce((sum: number, r: { sentCount: number }) => sum + r.sentCount, 0);
      setSummary(
        results.length === 0
          ? "No reminders were due today."
          : `Sent ${totalSent} email${totalSent === 1 ? "" : "s"} across ${results.length} reminder${results.length === 1 ? "" : "s"}.`
      );
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? "Running…" : "Run today's reminders now"}
      </button>
      {summary && <p className="text-sm text-muted">{summary}</p>}
    </div>
  );
}
