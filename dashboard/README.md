# SEA Retail Media SSOT — Dashboard (PRD-B)

Next.js 15 + TypeScript dashboard that reads from `mart.daily_channel_panel`
and `mart.daily_channel_panel_evc` (populated by PRD-A). Built for live CPG
measurement demos with an opinionated narrative: Google Ads → Shopee leads
on ROAS; Shopee Ads (aggregate) leads on wallet share; Meta CPAS is third;
TikTok Ads is intentionally a small, sub-1× line.

Design is "Analytical Terminal" — cool palette, Inter Tight + IBM Plex Mono,
hairline rules, no warm tones. Ported from the Claude Design handoff bundle.

## Status

**Phase 1 + 2 shipped.** All four Overview lenses + the Channel Brief are
live.

_Shell_
- Masthead (status strip, nav tabs, lens tabs, filter bar) + EVC toggle.
- URL-encoded filter state (`?range=14&market=all&evc=true&lens=editorial`).
- `/api/meta` health endpoint, optional `DEMO_ACCESS_CODE` middleware.

_Four lenses on `/` (switchable via the Lens strip)_
- **Editorial** — lead-story block with hero KPIs, MOVE/GEO/WATCH beats,
  daily GMV-vs-spend line, top-6 stacked columns, 6-market cards, ranked
  channel ledger.
- **Decisions** — three reallocation cards pinned Google → Shopee Ads →
  Meta. Each card has rank + conviction, hypothesis, evidence chips,
  mini-chart, expected GMV impact, queue/snooze actions. Watchlist of
  runners-up on the right. Evidence panel shows a ConnectedScatter for
  the focused channel's 14-day spend × ROAS path.
- **Decomposition** — GMV-movement waterfall (prior → channel
  contributions → this), CTR × CVR × AOV lever bridge (log-share
  decomposition) for the focused channel, Marimekko of spend share ×
  ROAS with the blended benchmark.
- **Pacing** — 4 dials (GMV, Spend, Orders, Blended ROAS) with MTD vs
  plan and EOM forecast, per-channel pacing table with forecast + gap,
  channel × market small-multiples grid.

_Channel brief on `/channel`_
- Compact dropdown ordered Shopee Ads → Google → Meta → TikTok →
  organic.
- 6-up KPI strip (Spend, Attr GMV, ROAS, Orders, CTR, CVR) with WoW
  deltas.
- Daily spend + daily GMV time series.
- Market breakdown (6 cards, sorted by spend).
- Market × day spend heatmap (21 days).

_Data layer_
- 9 chart primitives as custom SVG components (LineChart,
  StackedColumns, Sparkline, Waterfall, Marimekko, ConnectedScatter,
  LeverBridge, SmallMultiples, PacingDial).
- BigQuery adapter with lazy init + graceful fallback to a
  deterministic mock panel. EVC toggle switches the target table
  (`daily_channel_panel` ↔ `daily_channel_panel_evc`) and the ROAS
  label.
- Channel priority: Shopee Ads (5 sub-channels) → Google → Meta →
  TikTok → organic. Matches the PRD-A simulation generator's narrative.

**Future (Phase 3 / backlog):**
- Narrated walkthrough mode (Demo Mode callouts per view).
- Screenshot / PDF export per lens.
- Scenario selector (Competitor launch, Supply shortage, …) — plugs
  into `gen-data scenarios apply`.
- Period-over-period comparison mode.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript 5 (strict) |
| Styling | CSS variables + inline styles (matches the design bundle) |
| Charts | Custom SVG (ported from the design wireframe's analytical primitives) |
| BQ client | `@google-cloud/bigquery` (server-only) |
| Data fallback | Deterministic in-memory mock that matches the PRD-A narrative |

## Local development

```bash
cd dashboard
cp .env.example .env.local
# edit .env.local — set NEXT_PUBLIC_USE_MOCK=1 to stay in mock mode
npm install
npm run dev
# -> http://localhost:3000
```

The dashboard runs without any GCP credentials by default (mock mode).
With `NEXT_PUBLIC_USE_MOCK=0` + `GCP_PROJECT` set + a service-account key,
it reads live from `mart.daily_channel_panel` / `daily_channel_panel_evc`.

## Deploy to Vercel

The dashboard lives in a subdirectory (`dashboard/`) of the main Python repo,
so the import flow has one extra step:

1. **Import** — Vercel dashboard → New Project → import
   `albertyunarto/sea-retail-media-ssot`.
2. **Root Directory** — set this to `dashboard`. Vercel detects Next.js
   automatically from there and picks up `dashboard/vercel.json`.
3. **Build / install commands** — leave as the auto-detected defaults
   (`next build` / `npm install`).
4. **Environment variables** — minimum:
   - For a pure demo (no GCP needed): set `NEXT_PUBLIC_USE_MOCK=1` and
     nothing else. The dashboard ships with deterministic mock data that
     matches the PRD-A narrative — enough for a live URL you can share.
   - For live BigQuery: set `NEXT_PUBLIC_USE_MOCK=0`, `GCP_PROJECT`,
     `BQ_LOCATION`, `MART_DATASET`, and paste the service-account JSON
     into `GOOGLE_APPLICATION_CREDENTIALS_JSON` (NOT
     `GOOGLE_APPLICATION_CREDENTIALS` — Vercel has no filesystem to
     point at).
   - Optional: set `DEMO_ACCESS_CODE=<some-string>` to gate the dashboard
     behind `?code=<some-string>` on first visit.
5. **Deploy.** First build takes ~90 s; subsequent builds land in ~25 s.

### Gotchas

- `@google-cloud/bigquery` ships native-ish deps (grpc + protobuf). It
  runs fine on Vercel's Node.js runtime but **would fail on Edge** — so
  the pages and routes that touch it stay on Node (enforced via
  `vercel.json`). Don't add `export const runtime = "edge"` to any page
  that imports `lib/bq.ts` or `lib/panel-data.ts`.
- The middleware (`middleware.ts`) runs on Edge by default, but only
  uses `NextRequest` / `NextResponse` / cookies — all Edge-safe.
- Serverless function size budget: the full build lands around 30 MB —
  well under the 50 MB Hobby / 250 MB Pro cap.
- Paste the service-account JSON as a **Sensitive** env var so it isn't
  rendered in build logs.

## Environment variables

| var | required | purpose |
|---|---|---|
| `GCP_PROJECT` | prod | Target BigQuery project |
| `BQ_LOCATION` | prod | default `asia-southeast1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | prod | path to service-account JSON |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Vercel | inline service-account JSON |
| `MART_DATASET` | optional | default `mart` |
| `NEXT_PUBLIC_USE_MOCK` | dev | `1` forces mock regardless of creds |
| `DEMO_ACCESS_CODE` | optional | if set, middleware requires `?code=X` |

## File layout

```
dashboard/
  app/
    layout.tsx             # shell + font preload
    page.tsx               # overview (editorial | decisions | decomposition | pacing)
    channel/page.tsx       # channel deep-dive (Phase 2 stub)
    api/meta/route.ts      # data source + date-range metadata
    globals.css            # palette CSS vars + analytical grid overlay
  components/
    masthead.tsx           # status strip, nav tabs, lens tabs, filter bar, EVC toggle
    primitives.tsx         # KPI, SectionHead, Tag, SectionHeader, ghostBtn
    lens/
      editorial.tsx        # the lead-story overview
      placeholder.tsx      # Phase 2 stub for non-editorial lenses
    charts/
      line-chart.tsx, stacked-columns.tsx, sparkline.tsx,
      waterfall.tsx, marimekko.tsx, connected-scatter.tsx,
      lever-bridge.tsx, small-multiples.tsx, pacing-dial.tsx
  lib/
    tokens.ts              # C palette + channel colour map + font vars
    taxonomy.ts            # MARKETS, CHANNELS, priority order
    types.ts               # PanelRow, Filters, Channel union
    format.ts              # fmtUSD, fmtNum, fmtPct, fmtDelta
    mock-panel.ts          # deterministic seed=42-shaped mock
    aggregations.ts        # filterPanel, aggKPIs, computeWeeklyStory, channel trend
    bq.ts                  # BigQuery client (server-only, lazy)
    panel-data.ts          # single getPanel() dispatch (mock or BQ)
  middleware.ts            # optional DEMO_ACCESS_CODE gate
```

## Narrative lock

The same priority order used in the mock data and the ranking table:

1. **Shopee Ads** (5 sub-channels combined — largest wallet bucket)
2. **Google Ads → Shopee** — hero accent blue, highest ROAS
3. **Meta CPAS** — efficient mid-tier
4. **TikTok Ads** — intentionally small, sub-1× ROAS
5. Organic (Shopee / TikTok Shop) — no spend, baseline context

This matches the PRD-A Python simulation generator's narrative after the
retune commit (`ebd4815`).
