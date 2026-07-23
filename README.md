# Job Signal

Personal hiring-trends cockpit. Polls public ATS boards (Greenhouse, Lever, Ashby, Workday) plus optional JSearch, stores MoM / QoQ snapshots in SQLite, and recommends roles from your resume weighted by **fit × trend**.

## Quick start

```bash
cd ~/Projects/job-signal
cp .env.example apps/web/.env.local   # optional keys
npm install
cd workers/ingest && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..
npm run db:migrate --workspace=web
npm run db:seed --workspace=web
npm run ingest --workspace=web        # or: npm run ingest  (Python worker)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Trends** — WoW / MoM / QoQ for role families, domains, and companies; multi-select source filter
- **Companies** — watchlist CRUD for ATS boards
- **Resume** — PDF or pasted text → skills / titles / domains
- **Aim** — ranked targets with “why you fit” and “why it’s hot”, plus example openings

## Data sources

| Source | How |
|--------|-----|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| Lever | `api.lever.co/v0/postings/{site}` |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` |
| Workday | Company CXS `.../wday/cxs/.../jobs` POST |
| JSearch | RapidAPI (optional `JSEARCH_API_KEY`) |

Edit seed list in [`data/companies.yaml`](data/companies.yaml) or manage in the UI.

## Daily ingest

```bash
# TypeScript (same DB the app uses)
npm run ingest --workspace=web

# Python worker
JOB_SIGNAL_DB=./data/job-signal.db npm run ingest
```

Schedule with cron / launchd as you like. History compounds: first run shows a baseline; after a week you get WoW; after two months, real MoM.

## Optional env

```env
JSEARCH_API_KEY=          # broader market coverage
OPENAI_API_KEY=           # reserved for richer classification later
DATABASE_URL=file:../../data/job-signal.db
```

## Deploy (Vercel)

Connected to GitHub: push to `main` and Vercel auto-deploys.

Project settings:
- **Root Directory**: `apps/web`
- Optional durable DB: set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (otherwise the app hydrates from `data/vercel-seed.json` into ephemeral `/tmp` SQLite)

Production: https://job-signal-anushkamathur14-clouds-projects.vercel.app

## Layout

```
apps/web/           Next.js dashboard + APIs
packages/db/        Drizzle schema
workers/ingest/     Python collectors
data/               companies.yaml + SQLite DB
```
