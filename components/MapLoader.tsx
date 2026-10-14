"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it must only render in the browser
const ResourceMap = dynamic(() => import("./ResourceMap").then((m) => m.ResourceMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading map…</div>,
});

export function MapLoader() {
  return <ResourceMap />;
}
