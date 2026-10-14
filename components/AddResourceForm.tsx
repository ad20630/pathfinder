"use client";

import { useState } from "react";
import { scenario } from "@/config/scenario";

export type Draft = {
  type: string;
  title: string;
  description: string;
  status: string;
  skills: string;
  link: string;
  contact: string;
};

export const emptyDraft: Draft = {
  type: scenario.types[0].id,
  title: "",
  description: "",
  status: "available",
  skills: "",
  link: "",
  contact: "",
};

type Props = {
  draft: Draft;
  onChange: (d: Draft) => void;
  hasLocation: boolean;
  approximate?: boolean;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  onAiParsed: (d: Draft, locationHint: string) => void;
};

export function AddResourceForm({ draft, onChange, hasLocation, approximate, onSubmit, onCancel, onAiParsed }: Props) {
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  async function runAi() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "AI parse failed");
      const { locationHint, ...parsed } = await res.json();
      onAiParsed({ ...draft, ...parsed }, locationHint);
      setAiText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Describe it in your own words (AI fills the form)</label>
        <div className="flex gap-2">
          <input
            className={field}
            placeholder={scenario.ui.postPlaceholder}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <button
            className="rounded bg-violet-600 px-3 text-sm text-white disabled:opacity-50"
            disabled={busy || !aiText.trim()}
            onClick={runAi}
          >
            ✨
          </button>
        </div>
      </div>

      <select className={field} value={draft.type} onChange={(e) => set({ type: e.target.value })}>
        {scenario.types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.emoji} {t.label}
          </option>
        ))}
      </select>
      <input className={field} placeholder="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      <textarea
        className={field}
        rows={3}
        placeholder="Details (pay, schedule, requirements, cost)"
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <select className={field} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
        {scenario.statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        className={field}
        placeholder="Skills, comma-separated (e.g. forklift, inventory)"
        value={draft.skills}
        onChange={(e) => set({ skills: e.target.value })}
      />
      <input
        className={field}
        placeholder="Apply / info link (https://...)"
        value={draft.link}
        onChange={(e) => set({ link: e.target.value })}
      />
      <input
        className={field}
        placeholder="Contact (optional)"
        value={draft.contact}
        onChange={(e) => set({ contact: e.target.value })}
      />

      <p className="text-xs text-zinc-500">
        {!hasLocation
          ? "Click the map to choose a location"
          : approximate
            ? "📍 Approximate location (street only). Click the map to place it exactly."
            : "📍 Location set (click the map to move it)"}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !hasLocation || !draft.title.trim()}
          onClick={submit}
        >
          Add marker
        </button>
        <button className="rounded border border-zinc-300 px-3 text-sm dark:border-zinc-700" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
