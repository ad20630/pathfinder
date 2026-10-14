# Pathfinder

**A map of jobs, training and support for workers displaced by AI and automation.**

Displacement hits specific towns. Pathfinder shows a worker exactly where to land and what to learn:
describe your old job in plain language and Gemini works out your transferable skills, builds a short
plan (including an AI-literacy step), and highlights matching openings, classes and support on the map.

> The listings in the demo are **sample data** (fictional employers and programs around Alpharetta, GA).

## Features

- **Find my next step**: describe your background, get your transferable skills, a 2-4 step plan, and matches highlighted on the map.
- **AI description on every marker**: Gemini writes a short description from the listing's fields.
- **Post an opportunity**: type it in your own words ("Hiring 10 forklift operators near Old Milton Pkwy, $22/hr"); Gemini fills the form and the place is geocoded and pinned.
- **Live-ish map**: every client re-fetches markers every 5 seconds. "Still accurate" confirmations keep listings fresh; stale ones expire after 30 days.
- **Degrades gracefully**: if Gemini is unavailable or out of quota, search falls back to keyword matching and popups show the original text.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Leaflet + OpenStreetMap · PostgreSQL · Drizzle ORM · Gemini API

## Run locally

Requires Node 22+, pnpm and Docker.

```bash
pnpm install
cp .env.example .env.local        # then add your GEMINI_API_KEY (free from aistudio.google.com)
docker compose up -d db           # Postgres on :5432
pnpm db:push                      # create tables
pnpm db:seed                      # load sample listings
pnpm dev                          # http://localhost:3000
```

No Docker? Create a free [Neon](https://neon.tech) database and put its connection string in `DATABASE_URL`.

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local Docker default is in `.env.example`) |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.1-flash-lite` |

## Deploy (Vercel + Neon)

1. Push this repo to GitHub and import it in Vercel.
2. Add a Neon Postgres database (Vercel Marketplace) so `DATABASE_URL` is set automatically, then add `GEMINI_API_KEY`.
3. Create the tables and sample data once, from your machine, with the production `DATABASE_URL` in `.env.local`: `pnpm db:push && pnpm db:seed`.

## Adapting it to another use case

Everything use-case specific lives in **`config/scenario.ts`**: app name, map center, marker types (emoji and
color), status labels, button text, and the context given to Gemini. Types are stored as plain strings, so
changing them needs no database migration. (This project started as a hurricane resource map.)

## Project layout

```
config/scenario.ts     all use-case wording and marker types
db/                    Drizzle schema, connection, seed data
app/api/resources      list / create / update markers
app/api/search         "Find my next step" (Gemini)
app/api/summarize      per-marker AI description (Gemini, cached)
app/api/parse          free text -> structured marker (Gemini)
app/api/geocode        place name -> coordinates (OpenStreetMap Nominatim)
components/            map, add form, search panel
lib/                   validation, Gemini helper (with retries), rate limiter
```

## Known limits

- No accounts: anyone can post. Mitigated only by per-IP rate limits (in memory, best-effort) and confirmations/expiry.
- Geocoding uses free OpenStreetMap data, so small or new businesses may only resolve to a street (the form warns when a location is approximate).
- Gemini free-tier quota is limited; AI features fall back as described above when it runs out.
