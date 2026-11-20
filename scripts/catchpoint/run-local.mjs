#!/usr/bin/env node
/**
 * Runs a Catchpoint Playwright script locally by providing the same runtime globals
 * (page, expect, Catchpoint). Prints step timings, like Catchpoint's step breakdown.
 *
 *   node scripts/catchpoint/run-local.mjs scripts/catchpoint/order-journey.playwright.js [--headed]
 */
import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: run-local.mjs <script.js> [--headed]");
const source = readFileSync(file, "utf8");

const browser = await chromium.launch({
  headless: !process.argv.includes("--headed"),
  // --pin-dns: resolve *.techstore.win via Cloudflare's edge IP, bypassing a stale local DNS cache.
  args: process.argv.includes("--pin-dns") ? ["--host-resolver-rules=MAP *.techstore.win 104.21.96.65"] : [],
});
const requests = {};
let stepName = "";
const page = await browser.newPage();
page.on("requestfinished", (r) => {
  const s = (requests[stepName] ??= { n: 0, hosts: new Set() });
  s.n++;
  s.hosts.add(new URL(r.url()).host);
});
const steps = [];
let current = null;
const close = () => {
  if (current) steps.push({ ...current, ms: Date.now() - current.start });
};
const Catchpoint = {
  async startStep(name) {
    close();
    stepName = name;
    current = { name, start: Date.now() };
  },
  async username() {
    return "";
  },
  async password() {
    return "";
  },
};

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
let error;
try {
  await new AsyncFunction("page", "expect", "Catchpoint", source)(page, expect, Catchpoint);
} catch (e) {
  error = e;
}
close();
for (const s of steps) {
  const r = requests[s.name] ?? { n: 0, hosts: new Set() };
  console.log(`${s.ms.toString().padStart(6)} ms  ${String(r.n).padStart(3)} req  ${String(r.hosts.size).padStart(2)} hosts  ${s.name}`);
}
console.log(error ? `\nFAILED in "${steps.at(-1)?.name}": ${error.message.split("\n")[0]}` : "\nPASSED");
await browser.close();
process.exit(error ? 1 : 0);
