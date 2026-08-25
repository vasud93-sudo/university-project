"use client";

import { useState, useTransition } from "react";

export function SelfReportToggle({ activityId, initialReported }: { activityId: string; initialReported: boolean }) {
  const [reported, setReported] = useState(initialReported);
  const [pending, startTransition] = useTransition();

  function markRegistered() {
    if (reported) return;
    setReported(true);
    startTransition(async () => {
      const res = await fetch("/api/self-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      if (!res.ok) setReported(false);
    });
  }

  if (reported) {
    return (
      <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 text-sm font-medium">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        You&apos;ve marked yourself as registered for this activity
      </div>
    );
  }

  return (
    <button
      onClick={markRegistered}
      disabled={pending}
      className="w-full border border-border rounded-xl px-4 py-3 text-sm font-medium hover:bg-black/[.02] disabled:opacity-60 transition-colors"
    >
      {pending ? "Saving…" : "I've registered for this ✓"}
    </button>
  );
}
