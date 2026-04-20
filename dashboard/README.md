# SEA Retail Media SSOT — Dashboard (PRD-B)

Next.js 15 + TypeScript dashboard that reads from `mart.daily_channel_panel`
and `mart.daily_channel_panel_evc` (populated by PRD-A). Built for live CPG
measurement demos with an opinionated narrative: Google Ads → Shopee leads
on ROAS; Shopee Ads (aggregate) leads on wallet share; Meta CPAS is third;
TikTok Ads is intentionally a small, sub-1× line.

Design is "Analytical Terminal" — cool palette, Inter Tight + IBM Plex Mono,
hairline rules, no warm tones. Ported from the Claude Design handoff bundle.

## Status

**Phase 1 (this commit) — shipped:**
- App shell: masthead (status strip, nav tabs, lens tabs, filter bar) + EVC toggle.
- URL-encoded filter state (`?range=14&market=all&evc=true&lens=editorial`).
- **Editorial lens** (`/?lens=editorial`) — lead-story block with hero KPIs,
  three MOVE/GEO/WATCH beats, daily GMV-vs-spend line, top-6 stacked columns,
  6-market cards, ranked channel ledger.
- Chart primitives ported as SVG React components: LineChart, StackedColumns,
  Sparkline, Waterfall, Marimekko, ConnectedScatter, LeverBridge, SmallMultiples,
  PacingDial.
- BigQuery adapter (`lib/bq.ts`) with lazy client init + graceful fallback to
  the deterministic mock panel when creds are missing.
- Channel taxonomy priority-ordered: Shopee Ads sub-channels → Google →
  Meta → TikTok → organic.

**Phase 2 (next) — planned:**
- Decisions lens — 3 pinned reallocation cards (Google / Shopee Ads / Meta).
- Decomposition lens — waterfall + CTR × CVR × AOV lever bridge + marimekko.
- Pacing lens — MTD dials + channel pacing table + small-multiples grid.
- Channel brief (`/channel`) — compact dropdown + market breakdown + heatmap.
- Narrated walkthrough mode (Demo Mode callouts).

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
