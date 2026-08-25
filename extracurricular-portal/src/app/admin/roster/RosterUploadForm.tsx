"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function parseCsv(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Tolerate an optional header row (name,email,grade,section).
  const start = /^name\s*,\s*email/i.test(lines[0]) ? 1 : 0;

  return lines.slice(start).map((line) => {
    const [name, email, grade, section] = line.split(",").map((c) => c.trim());
    return { name, email, grade: Number(grade), section: section || undefined };
  });
}

export function RosterUploadForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    const rows = parseCsv(text);
    if (rows.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/admin/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    setBusy(false);
    if (res.ok) {
      setResult(await res.json());
      setText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="border border-border rounded-2xl p-5 bg-surface space-y-3">
      <div>
        <p className="text-sm font-semibold mb-1">Upload roster</p>
        <p className="text-xs text-muted">
          CSV with columns <code className="bg-black/[.04] px-1 rounded">name, email, grade, section</code>. Re-uploading
          updates existing students by email.
        </p>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-xs" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"name,email,grade,section\nAarav Mehta,aarav.mehta@fountainheadschools.org,9,A"}
        className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
      />
      <button
        onClick={submit}
        disabled={busy || text.trim().length === 0}
        className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload roster"}
      </button>
      {result && (
        <p className="text-xs text-muted">
          {result.created} added, {result.updated} updated.
          {result.errors.length > 0 && (
            <span className="text-danger">
              {" "}
              {result.errors.length} skipped — {result.errors.slice(0, 3).join("; ")}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
