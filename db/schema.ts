import { doublePrecision, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // see config/scenario.ts
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    status: text("status").notNull().default("available"),
    skills: text("skills").notNull().default(""), // comma-separated skills needed or taught
    link: text("link"), // apply / info URL
    contact: text("contact"),
    confirmations: integer("confirmations").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resources_lat_lng_idx").on(t.lat, t.lng)],
);

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
