"use client";

import { useState, useTransition } from "react";

export function ShortlistButton({ activityId, initialShortlisted }: { activityId: string; initialShortlisted: boolean }) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !shortlisted;
    setShortlisted(next);
    startTransition(async () => {
      const res = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, shortlisted: next }),
      });
      if (!res.ok) setShortlisted(!next);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={shortlisted}
      title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`h-7 w-7 rounded-full grid place-items-center transition-colors shrink-0 ${
        shortlisted ? "bg-primary text-white" : "bg-black/[.04] text-muted hover:bg-black/[.08]"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={shortlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M5 3v18l7-5 7 5V3H5z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
