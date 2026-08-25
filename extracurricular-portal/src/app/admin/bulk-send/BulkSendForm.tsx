"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Activity = { id: string; title: string };
type Group = { label: string; emails: string[] };

export function BulkSendForm({ activities, groups }: { activities: Activity[]; groups: Group[] }) {
  const router = useRouter();
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [pastedEmails, setPastedEmails] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const groupEmails = useMemo(
    () => groups.filter((g) => selectedGroups.has(g.label)).flatMap((g) => g.emails),
    [groups, selectedGroups]
  );

  const pastedList = useMemo(
    () =>
      pastedEmails
        .split(/[\n,;]/)
        .map((e) => e.trim())
        .filter(Boolean),
    [pastedEmails]
  );

  const recipients = useMemo(() => [...new Set([...groupEmails, ...pastedList])], [groupEmails, pastedList]);

  function toggleGroup(label: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function submit() {
    if (!activityId || recipients.length === 0) return;
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/bulk-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId,
        emails: recipients,
        note,
        targetLabel: [...selectedGroups].join(", ") || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setResult(await res.json());
      setPastedEmails("");
      setSelectedGroups(new Set());
      setNote("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-1.5">Activity to send</p>
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">Pick class(es) from the roster</p>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.label}
              onClick={() => toggleGroup(g.label)}
              className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                selectedGroups.has(g.label) ? "bg-primary-soft text-primary border-transparent" : "border-border text-muted"
              }`}
            >
              {g.label} ({g.emails.length})
            </button>
          ))}
          {groups.length === 0 && <p className="text-xs text-muted">No roster uploaded yet — add students on the Roster page.</p>}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">Or paste emails directly</p>
        <textarea
          value={pastedEmails}
          onChange={(e) => setPastedEmails(e.target.value)}
          rows={4}
          placeholder="one@school.org, two@school.org&#10;three@school.org"
          className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-1.5">Optional note (prepended to the email)</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Flagging this one especially for our Grade 9 debaters!"
          className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={submit}
          disabled={busy || !activityId || recipients.length === 0}
          className="bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? "Sending…" : `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
        </button>
        {result && (
          <p className="text-sm text-muted">
            {result.sent} sent{result.failed > 0 && `, ${result.failed} failed`}
            {result.skipped > 0 && `, ${result.skipped} skipped (invalid address)`}.
          </p>
        )}
      </div>
    </div>
  );
}
