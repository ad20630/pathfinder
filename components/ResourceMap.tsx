"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import useSWR from "swr";
import { scenario, statusInfo, typeInfo } from "@/config/scenario";
import type { Resource } from "@/db/schema";
import { AddResourceForm, emptyDraft, type Draft } from "./AddResourceForm";
import { FindResourcePanel, type SearchResult } from "./FindResourcePanel";

type LatLng = { lat: number; lng: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const POLL_MS = 5000; // how often every client re-fetches markers

// "hit" = matched the current search (pulses), "dim" = not a match while a search is active
type PinMode = "normal" | "hit" | "dim";

function pinIcon(emoji: string, fill: string, ring: string, mode: PinMode = "normal") {
  const size = mode === "hit" ? 42 : 34;
  const outline = mode === "hit" ? "outline:4px solid #facc15;" : "";
  return L.divIcon({
    className: "", // drop Leaflet's default white box
    html: `<div class="${mode === "hit" ? "pin-hit" : ""}" style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};border:3px solid ${ring};${outline}display:flex;align-items:center;justify-content:center;font-size:${mode === "hit" ? 20 : 16}px;box-shadow:0 2px 6px rgba(0,0,0,.4)">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Exposes the map instance to the parent so it can pan after geocoding
function MapRef({ setMap }: { setMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => setMap(map), [map, setMap]);
  return null;
}

// One-line Gemini summary, fetched when the popup opens (refreshes when the marker changes)
function Summary({ r }: { r: Resource }) {
  const { data, isLoading } = useSWR<{ summary?: string }>(
    `summary-${r.id}-${r.updatedAt}`,
    () =>
      fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      }).then((res) => res.json()),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  if (isLoading) return <p className="text-xs italic text-zinc-500">✨ Summarizing…</p>;
  // If the AI is unavailable (quota, outage), fall back to the original text so the popup is never empty
  if (!data?.summary) return r.description ? <p>{r.description}</p> : null;
  return <p>✨ {data.summary}</p>;
}

export function ResourceMap() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [finding, setFinding] = useState(false);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [posApprox, setPosApprox] = useState(false); // geocoder only matched a street/area
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const url = "/api/resources" + (filter ? `?type=${filter}` : "");
  const { data, mutate } = useSWR<Resource[]>(url, fetcher, { refreshInterval: POLL_MS });
  const resources = Array.isArray(data) ? data : [];
  const hitIds = new Set(search?.results.map((r) => r.id));

  function closeAdd() {
    setAdding(false);
    setPos(null);
    setPosApprox(false);
    setDraft(emptyDraft);
  }

  function closeFind() {
    setFinding(false);
    setSearch(null);
  }

  async function submit() {
    if (!pos) return;
    const res = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, ...pos, link: draft.link || null, contact: draft.contact || null }),
    });
    if (!res.ok) throw new Error("Could not save marker");
    closeAdd();
    mutate();
  }

  async function patch(id: string, body: object) {
    await fetch(`/api/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    mutate();
  }

  // After Gemini fills the form, geocode the place it mentioned and drop the pin there
  async function onAiParsed(d: Draft, locationHint: string) {
    setDraft(d);
    if (!locationHint || !map) return;
    try {
      const c = map.getCenter();
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationHint)}&lat=${c.lat}&lng=${c.lng}`);
      if (!res.ok) return;
      const { approximate, ...p }: LatLng & { approximate?: boolean } = await res.json();
      setPos(p);
      setPosApprox(!!approximate);
      map.flyTo(p, Math.max(map.getZoom(), 15));
    } catch {
      // geocoding is best-effort; the user can still click the map
    }
  }

  async function runSearch(query: string): Promise<SearchResult> {
    const c = map?.getCenter();
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, lat: c?.lat, lng: c?.lng }),
    });
    if (!res.ok) throw new Error("Search failed");
    const result: SearchResult = await res.json();
    setSearch(result);
    setFilter(null); // make sure every match is on the map
    if (map && result.results.length) {
      map.closePopup();
      map.fitBounds(L.latLngBounds(result.results.map((r) => [r.lat, r.lng] as [number, number])), {
        paddingTopLeft: [40, 130],
        paddingBottomRight: [40, 320],
        maxZoom: 15,
      });
    }
    return result;
  }

  function selectResult(id: string) {
    const r = search?.results.find((x) => x.id === id);
    if (!r || !map) return;
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 15));
    markerRefs.current[id]?.openPopup();
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer center={scenario.center} zoom={scenario.zoom} className="h-full w-full" zoomControl={false}>
        <MapRef setMap={setMap} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler
          onClick={(p) => {
            if (!adding) return;
            setPos(p);
            setPosApprox(false);
          }}
        />

        {resources.map((r) => {
          const t = typeInfo(r.type);
          const s = statusInfo(r.status);
          const mode: PinMode = !search ? "normal" : hitIds.has(r.id) ? "hit" : "dim";
          return (
            <Marker
              key={r.id}
              ref={(m) => {
                markerRefs.current[r.id] = m;
              }}
              position={[r.lat, r.lng]}
              icon={pinIcon(t.emoji, t.color, s.color, mode)}
              opacity={mode === "dim" ? 0.35 : 1}
              zIndexOffset={mode === "hit" ? 1000 : 0}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">
                    {t.emoji} {r.title}
                  </div>
                  <Summary r={r} />
                  <div style={{ color: s.color }} className="text-xs font-medium">
                    {s.label} · updated {new Date(r.updatedAt).toLocaleString()}
                  </div>
                  {r.skills && (
                    <div className="flex flex-wrap gap-1">
                      {r.skills.split(",").map((sk) => (
                        <span key={sk} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                          {sk.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 underline">
                      Apply / learn more →
                    </a>
                  )}
                  {r.contact && <p className="text-xs">Contact: {r.contact}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      className="rounded bg-green-600 px-2 py-1 text-xs text-white"
                      onClick={() => patch(r.id, { confirm: true })}
                    >
                      {scenario.ui.confirmLabel} ({r.confirmations})
                    </button>
                    <select
                      className="rounded border px-1 py-1 text-xs"
                      value={r.status}
                      onChange={(e) => patch(r.id, { status: e.target.value })}
                    >
                      {scenario.statuses.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {pos && <Marker position={[pos.lat, pos.lng]} icon={pinIcon("📍", "#ffffff", "#2563eb")} />}
      </MapContainer>

      {/* z-[1000] keeps the overlays above Leaflet's panes */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3">
        <div className="pointer-events-auto w-fit rounded-lg bg-white/95 px-3 py-2 shadow dark:bg-zinc-900/95">
          <h1 className="text-base font-bold">{scenario.name}</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{scenario.tagline}</p>
          <p className="text-[10px] text-zinc-400">Demo: listings are sample data</p>
        </div>
        <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={filter === null} onClick={() => setFilter(null)}>
            All
          </Chip>
          {scenario.types.map((t) => (
            <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(filter === t.id ? null : t.id)}>
              {t.emoji} {t.label}
            </Chip>
          ))}
        </div>
      </header>

      {adding || finding ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-[1000] overflow-y-auto rounded-t-xl ${adding ? "max-h-full" : "max-h-[45%]"} bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-80 sm:rounded-xl dark:bg-zinc-950`}
        >
          {adding ? (
            <AddResourceForm
              draft={draft}
              onChange={setDraft}
              hasLocation={!!pos}
              approximate={posApprox}
              onSubmit={submit}
              onCancel={closeAdd}
              onAiParsed={onAiParsed}
            />
          ) : (
            <FindResourcePanel onSearch={runSearch} result={search} onSelect={selectResult} onClose={closeFind} />
          )}
        </div>
      ) : (
        <div className="absolute bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 gap-2">
          <button
            className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg sm:px-5 sm:py-3 sm:text-base"
            onClick={() => setFinding(true)}
          >
            {scenario.ui.findLabel}
          </button>
          <button
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg sm:px-5 sm:py-3 sm:text-base"
            onClick={() => setAdding(true)}
          >
            {scenario.ui.addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium shadow ${
        active ? "bg-blue-600 text-white" : "bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
