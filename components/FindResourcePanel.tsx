"use client";

import { useState } from "react";
import { scenario, statusInfo, typeInfo } from "@/config/scenario";
import type { Resource } from "@/db/schema";
import { Spinner } from "./Spinner";

export type SearchResult = {
  answer: string;
  skills: string[];
  plan: { text: string; resourceId?: string }[];
  results: (Resource & { distanceKm: number | null })[];
};

type Props = {
  onSearch: (query: string) => Promise<SearchResult>;
  result: SearchResult | null;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function FindResourcePanel({ onSearch, result, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onSearch(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <input
          autoFocus
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          placeholder={scenario.ui.findPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="flex min-w-12 items-center justify-center rounded bg-violet-600 px-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy || !query.trim()}
        >
          {busy ? <Spinner /> : "Go"}
        </button>
      </form>

      {!result && !busy && (
        <div className="flex flex-col items-start gap-1.5">
          {scenario.ui.findExamples.map((ex) => (
            <button
              key={ex}
              className="rounded-full border border-zinc-300 px-2.5 py-1 text-left text-xs dark:border-zinc-700"
              onClick={() => {
                setQuery(ex);
                run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">✨ {result.answer}</p>

          {result.skills.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Your transferable skills</p>
              <div className="flex flex-wrap gap-1">
                {result.skills.map((s) => (
                  <span key={s} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.plan.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Your plan</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {result.plan.map((p, i) => (
                  <li key={i}>
                    {p.resourceId ? (
                      <button className="text-left underline decoration-dotted" onClick={() => onSelect(p.resourceId!)}>
                        {p.text}
                      </button>
                    ) : (
                      p.text
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.results.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Matches on the map</p>
              <ul className="flex flex-col gap-1">
                {result.results.map((r) => {
                  const s = statusInfo(r.status);
                  return (
                    <li key={r.id}>
                      <button
                        className="flex w-full items-start gap-2 rounded border border-zinc-200 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        onClick={() => onSelect(r.id)}
                      >
                        <span>{typeInfo(r.type).emoji}</span>
                        <span className="flex-1">
                          <span className="block font-medium">{r.title}</span>
                          <span className="block text-xs" style={{ color: s.color }}>
                            {s.label}
                            {r.distanceKm != null && (
                              <span className="text-zinc-500"> · {(r.distanceKm * 0.621371).toFixed(1)} mi away</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        className="self-start rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        onClick={onClose}
      >
        {result ? "Clear search" : "Close"}
      </button>
    </div>
  );
}
