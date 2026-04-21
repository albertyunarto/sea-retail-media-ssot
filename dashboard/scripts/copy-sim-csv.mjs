#!/usr/bin/env node
/**
 * Copies the canonical simulated-data CSVs from `<repo>/data/sim-csv/` into
 * `dashboard/public/sim-csv/` so Vercel serves them as static assets at
 * `https://<your-app>.vercel.app/sim-csv/<source>.csv`. Supermetrics' URL /
 * CSV source can then be pointed at those URLs on schedule, so you get
 * Supermetrics-in-the-loop without uploading anything to Google Sheets.
 *
 * Runs automatically via the `prebuild` npm hook. Safe to re-run: the
 * target dir is emptied each time.
 */
import { readdirSync, mkdirSync, rmSync, copyFileSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..", "..", "data", "sim-csv");
const DST = resolve(__dirname, "..", "public", "sim-csv");

if (!existsSync(SRC)) {
  console.log(`[copy-sim-csv] source ${SRC} not found — skipping (expected on Vercel if data/ isn't shipped).`);
  process.exit(0);
}

if (existsSync(DST)) rmSync(DST, { recursive: true, force: true });
mkdirSync(DST, { recursive: true });

const files = readdirSync(SRC).filter((f) => !f.startsWith("."));
const manifest = [];
for (const f of files) {
  const srcPath = join(SRC, f);
  const dstPath = join(DST, f);
  const stat = statSync(srcPath);
  if (!stat.isFile()) continue;
  copyFileSync(srcPath, dstPath);
  manifest.push({ file: f, size_bytes: stat.size });
  console.log(`[copy-sim-csv] ${f}  (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
}

// Tiny index so clients / Supermetrics-admins can discover what's available.
writeFileSync(
  join(DST, "index.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source: "data/sim-csv",
      files: manifest,
    },
    null,
    2,
  ),
);

console.log(`[copy-sim-csv] wrote ${manifest.length} files to ${DST}`);
