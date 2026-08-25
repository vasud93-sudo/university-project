"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { clusterColor } from "@/lib/cluster-colors";

type ClusterOption = { id: string; name: string; colorTag: string };

export function FilterBar({
  clusters,
  defaultGrade,
}: {
  clusters: ClusterOption[];
  defaultGrade: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const activeCluster = searchParams.get("cluster");
  const gradeScope = searchParams.get("grades") ?? (defaultGrade ? "mine" : "all");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    startTransition(() => router.push(`/browse?${params.toString()}`));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q || null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="relative flex-1 max-w-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activities…"
            className="w-full border border-border rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
          />
          <svg className="absolute left-3 top-2.5 text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </form>

        {defaultGrade && (
          <div className="flex items-center gap-1 bg-black/[.03] rounded-full p-1 text-sm">
            <button
              onClick={() => updateParam("grades", "mine")}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                gradeScope === "mine" ? "bg-surface shadow-sm" : "text-muted"
              }`}
            >
              My grade ({defaultGrade})
            </button>
            <button
              onClick={() => updateParam("grades", "all")}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                gradeScope === "all" ? "bg-surface shadow-sm" : "text-muted"
              }`}
            >
              All grades
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => updateParam("cluster", null)}
          className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
            !activeCluster ? "bg-foreground text-white border-foreground" : "border-border text-muted hover:border-foreground/30"
          }`}
        >
          All categories
        </button>
        {clusters.map((c) => {
          const color = clusterColor(c.colorTag);
          const active = activeCluster === c.id;
          return (
            <button
              key={c.id}
              onClick={() => updateParam("cluster", active ? null : c.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                active ? `${color.bg} ${color.text} border-transparent` : "border-border text-muted hover:border-foreground/30"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
