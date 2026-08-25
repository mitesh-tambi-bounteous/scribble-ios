// Dev-only baseline screenshot capture. Not wired into any build/CI script.
// Usage: node scripts/screenshot-all.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.argv[2] ?? "http://localhost:8090";
const OUT_DIR = path.resolve("screenshots");
const VIEWPORT = { width: 390, height: 844 };

const PROMPT_ID = "prompt-2026-07-01";
const CHANNEL_ID = "channel-1";
const RESPONSE_ID = "response-alice-1";

const STATIC_ROUTES = [
  { name: "index", path: "/" },
  { name: "splash", path: "/splash" },
  { name: "sign-up", path: "/sign-up" },
  { name: "tutorial", path: "/tutorial" },
  { name: "home", path: "/home" },
  { name: "draw", path: "/draw" },
  { name: "write", path: "/write" },
  { name: "record", path: "/record" },
  { name: "family", path: "/family" },
  { name: "create-wall", path: "/create-wall" },
  { name: "not-found", path: "/this-route-does-not-exist" },
  {
    name: "wall",
    path: `/wall?channelId=${CHANNEL_ID}&promptId=${PROMPT_ID}`,
  },
  {
    name: "response",
    path: `/response/${RESPONSE_ID}?channelId=${CHANNEL_ID}&promptId=${PROMPT_ID}`,
  },
  {
    name: "share",
    path: `/share?id=${RESPONSE_ID}&authorName=Alice&text=${encodeURIComponent("A very sleepy cat.")}`,
  },
];

const THEMES = [
  { value: "ink", label: "Ink" },
  { value: "studio", label: "Studio" },
  { value: "notepad", label: "Notepad" },
];

const THEMED_ROUTES = [
  { name: "home", path: "/home" },
  { name: "wall", path: `/wall?channelId=${CHANNEL_ID}&promptId=${PROMPT_ID}` },
  { name: "draw", path: "/draw" },
];

const NAV_WAIT_MS = 1500;
const CANVAS_WAIT_MS = 2500;

async function shoot(page, route, suffix) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(route.name === "draw" ? CANVAS_WAIT_MS : NAV_WAIT_MS);
  const fileName = suffix ? `${route.name}-${suffix}.png` : `${route.name}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, fileName) });
  console.log(`captured ${fileName}`);
}

async function setThemeViaSwitcher(page, label) {
  await page.goto(`${BASE_URL}/home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(NAV_WAIT_MS);
  const button = page.getByRole("button", { name: `Switch to ${label} theme` });
  await button.click();
  await page.waitForTimeout(500);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const failures = [];

  for (const route of STATIC_ROUTES) {
    try {
      await shoot(page, route, null);
    } catch (err) {
      console.error(`FAILED ${route.name}: ${err.message}`);
      failures.push({ route: route.name, error: err.message });
    }
  }

  for (const theme of THEMES) {
    try {
      await setThemeViaSwitcher(page, theme.label);
      for (const route of THEMED_ROUTES) {
        await shoot(page, route, theme.value);
      }
    } catch (err) {
      console.error(`FAILED theme ${theme.value}: ${err.message}`);
      failures.push({ route: `theme:${theme.value}`, error: err.message });
    }
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("\nFailures:", JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log("\nAll captures succeeded.");
  }
}

main();
