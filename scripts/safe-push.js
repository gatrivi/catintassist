#!/usr/bin/env node
/**
 * Safe push — Vercel FREE tier budget guard (v4.92.0).
 *
 * Every push to master = a Vercel deploy. We are on the free tier: too many
 * deploys in a rolling hour can get the account closed (see AGENTS.md →
 * "PUSH BUDGET"). This script:
 *   1. counts pushes logged in docs/push-log.md within the last 60 minutes
 *   2. refuses to push once the budget (MAX_PER_HOUR) is used up
 *   3. pushes `git push origin HEAD:master` and appends the log row
 *
 * Usage:
 *   node scripts/safe-push.js                        # push HEAD:master if under budget
 *   node scripts/safe-push.js "v4.93.0 my feature"   # push with a label
 *   node scripts/safe-push.js --allow-over "label"   # ONLY after the user approved
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_PER_HOUR = 4;
const WINDOW_MS = 60 * 60 * 1000;
const LOG_PATH = path.join(__dirname, "..", "docs", "push-log.md");

const args = process.argv.slice(2);
const allowOver = args.includes("--allow-over");
const label = args.filter((a) => !a.startsWith("--")).join(" ").trim();

const readLog = () => {
  try {
    return fs.readFileSync(LOG_PATH, "utf8").split(/\r?\n/);
  } catch (_) {
    return [];
  }
};

const pushesInWindow = () => {
  const cutoff = Date.now() - WINDOW_MS;
  return readLog()
    .map((l) => (l.match(/^\|\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/) || [])[1])
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t) && t >= cutoff).length;
};

const used = pushesInWindow();
if (used >= MAX_PER_HOUR && !allowOver) {
  console.error("");
  console.error(`[PUSH BUDGET] ${used} pushes in the last 60 min (limit ${MAX_PER_HOUR}/h — Vercel free tier).`);
  console.error("[PUSH BUDGET] STOP: ask the user first. If approved, re-run with --allow-over.");
  console.error("");
  process.exit(1);
}

// Push first — only log pushes that actually happened.
execSync("git push origin HEAD:master", { stdio: "inherit" });

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const message = (label || execSync("git log -1 --pretty=%s").toString().trim()).replace(/\|/g, "/");
const row = `| ${new Date().toISOString()} | ${hash} | ${message} |`;

const lines = readLog();
while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
lines.push(row, "");
fs.writeFileSync(LOG_PATH, lines.join("\n"), "utf8");

console.log("");
console.log(`[PUSH BUDGET] logged ${row} — ${used + 1}/${MAX_PER_HOUR} pushes used in the last hour`);
console.log("");
