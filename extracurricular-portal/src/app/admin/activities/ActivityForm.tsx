"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Cluster = { id: string; name: string };

export type ActivityFormValues = {
  id?: string;
  title: string;
  organizer: string;
  summary: string;
  description: string;
  link: string;
  fee: string;
  mode: string;
  location: string;
  minGrade: number;
  maxGrade: number;
  registrationOpensOn: string; // yyyy-mm-dd
  registrationDeadline: string;
  eventDate: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  clusterId: string;
  sourceNote: string;
};

const emptyValues: ActivityFormValues = {
  title: "",
  organizer: "",
  summary: "",
  description: "",
  link: "",
  fee: "",
  mode: "Online",
  location: "",
  minGrade: 6,
  maxGrade: 12,
  registrationOpensOn: "",
  registrationDeadline: "",
  eventDate: "",
  status: "DRAFT",
  clusterId: "",
  sourceNote: "",
};

export function ActivityForm({ clusters, initialValues }: { clusters: Cluster[]; initialValues?: ActivityFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<ActivityFormValues>(initialValues ?? emptyValues);
  const [clusterList, setClusterList] = useState(clusters);
  const [newClusterName, setNewClusterName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initialValues?.id);

  function set<K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function addCluster() {
    if (newClusterName.trim().length < 2) return;
    const res = await fetch("/api/admin/clusters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClusterName.trim() }),
    });
    if (res.ok) {
      const { cluster } = await res.json();
      setClusterList((c) => [...c, cluster]);
      set("clusterId", cluster.id);
      setNewClusterName("");
    }
  }

  async function handleSubmit(e: React.FormEvent, status?: ActivityFormValues["status"]) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = { ...values, status: status ?? values.status };
    const res = await fetch(isEdit ? `/api/admin/activities/${initialValues!.id}` : "/api/admin/activities", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Couldn't save — check the required fields.");
      return;
    }
    router.push("/admin/activities");
    router.refresh();
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm("Delete this activity permanently? This also removes its click/reminder/shortlist history.")) return;
    const res = await fetch(`/api/admin/activities/${initialValues!.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/activities");
      router.refresh();
    }
  }

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-8 max-w-3xl">
      {error && <p className="text-sm text-danger bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      <Section title="Basics">
        <Field label="Title" required>
          <input required value={values.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Organizer">
          <input value={values.organizer} onChange={(e) => set("organizer", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Short summary (shown on cards)" required>
          <input required value={values.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} maxLength={160} />
        </Field>
        <Field label="Full description" required>
          <textarea
            required
            rows={7}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Category / cluster" required>
          <div className="flex flex-wrap gap-2 items-center">
            <select required value={values.clusterId} onChange={(e) => set("clusterId", e.target.value)} className={inputCls + " w-auto"}>
              <option value="" disabled>
                Select…
              </option>
              {clusterList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="New category name"
              value={newClusterName}
              onChange={(e) => setNewClusterName(e.target.value)}
              className={inputCls + " w-48"}
            />
            <button type="button" onClick={addCluster} className="text-sm font-medium text-primary hover:underline">
              + Add
            </button>
          </div>
        </Field>
      </Section>

      <Section title="Eligibility & logistics">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min grade" required>
            <input
              required
              type="number"
              min={1}
              max={12}
              value={values.minGrade}
              onChange={(e) => set("minGrade", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Max grade" required>
            <input
              required
              type="number"
              min={1}
              max={12}
              value={values.maxGrade}
              onChange={(e) => set("maxGrade", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee">
            <input value={values.fee} onChange={(e) => set("fee", e.target.value)} className={inputCls} placeholder="e.g. ₹500 or Free" />
          </Field>
          <Field label="Mode">
            <select value={values.mode} onChange={(e) => set("mode", e.target.value)} className={inputCls}>
              <option>Online</option>
              <option>Offline</option>
              <option>Hybrid</option>
            </select>
          </Field>
        </div>
        <Field label="Location">
          <input value={values.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Dates">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Registration opens">
            <input
              type="date"
              value={values.registrationOpensOn}
              onChange={(e) => set("registrationOpensOn", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Registration deadline" required>
            <input
              required
              type="date"
              value={values.registrationDeadline}
              onChange={(e) => set("registrationDeadline", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Event date">
            <input type="date" value={values.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Reminders auto-send 5 days before the deadline, halfway between &quot;opens&quot; and the deadline (skipped if
          &quot;opens&quot; is blank), and on the deadline day itself.
        </p>
      </Section>

      <Section title="Registration link">
        <Field label="Link" required>
          <input required type="url" value={values.link} onChange={(e) => set("link", e.target.value)} className={inputCls} placeholder="https://…" />
        </Field>
        <Field label="Internal note (optional, e.g. source communication #)">
          <input value={values.sourceNote} onChange={(e) => set("sourceNote", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, "PUBLISHED")}
          className="bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
        >
          {values.status === "PUBLISHED" ? "Save" : "Publish"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, "DRAFT")}
          className="border border-border rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-black/[.02] disabled:opacity-60"
        >
          Save as draft
        </button>
        {isEdit && (
          <button type="button" onClick={handleDelete} className="ml-auto text-sm font-medium text-danger hover:underline">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls =
  "w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-foreground mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground/80">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
