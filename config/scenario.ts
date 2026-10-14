// The ONLY file you need to edit to retarget the app to a different use case.
// `id`s are stored as plain strings in the DB, so changing types/labels needs no migration.

type TypeDef = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  /** Shown on the map but never returned as a search result (context, not an opportunity) */
  excludeFromSearch?: boolean;
};

const types: TypeDef[] = [
  { id: "hiring", label: "Job opening", emoji: "💼", color: "#2563eb" },
  { id: "training", label: "Training / retraining", emoji: "🎓", color: "#7c3aed" },
  { id: "support", label: "Career support", emoji: "🤝", color: "#b208ac" },
];

// ids are internal; only the labels are user-facing
const statuses = [
  { id: "available", label: "Open / hiring", color: "#16a34a" },
  { id: "depleted", label: "Closed / full", color: "#6b7280" },
];

export const scenario = {
  name: "Pathfinder",
  tagline: "Lost work to automation? Find nearby jobs and retraining that fit your skills.",
  // Initial map view (Alpharetta, GA)
  center: { lat: 34.0754, lng: -84.2941 },
  zoom: 11,
  // Context handed to Gemini in every prompt
  aiContext:
    "workers in Alpharetta, Georgia displaced by AI and automation, looking for new jobs, retraining and support",
  types,
  statuses,
  // Markers not updated/confirmed within this many hours are hidden
  expiryHours: 24 * 30,
  ui: {
    addLabel: "+ Post an opportunity",
    findLabel: "🔍 Find my next step",
    findPlaceholder: "Describe your last job and what happened",
    findExamples: [
      "Warehouse picker for 8 years, robots replaced my shift",
      "Call center agent laid off, no degree",
      "Bookkeeper who wants to learn AI tools",
    ],
    postPlaceholder: "Hiring 10 forklift operators near Old Milton Pkwy, $22/hr",
    confirmLabel: "✓ Still accurate",
    summaryAudience: "a worker displaced by automation",
  },
};

export const typeIds = types.map((t) => t.id) as [string, ...string[]];
export const statusIds = statuses.map((s) => s.id) as [string, ...string[]];

export function typeInfo(id: string) {
  return types.find((t) => t.id === id) ?? types[0];
}
export function statusInfo(id: string) {
  return statuses.find((s) => s.id === id) ?? statuses[0];
}
