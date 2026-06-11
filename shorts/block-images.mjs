// Render each block's internal schematic to a PNG (web/public/block-img/<slug>.png) by
// screenshotting the live block page's schematic <figure> in the default (Mid) theme.
// The PNGs feed per-block og:image + the image sitemap — theme-independent surfaces only;
// the on-page schematic stays live SVG so themes keep working.
// Run after blocks change: node block-images.mjs   (dev server must be on PORT, default 3261)
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync } from "node:fs";

const PORT = process.env.PORT ?? "3261";
const OUT = new URL("../web/public/block-img/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const slugs = readdirSync(new URL("../electrace/blocks/", import.meta.url).pathname);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--force-device-scale-factor=2", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });

let done = 0, skipped = 0;
for (const slug of slugs) {
  await page.goto(`http://localhost:${PORT}/blocks/${slug}`, { waitUntil: "networkidle2", timeout: 60000 });
  // the first <figure> is the block's own internal schematic; some blocks have no layout yet
  const fig = await page.$("main figure svg");
  if (!fig) { console.log(`skip ${slug} (no schematic figure)`); skipped++; continue; }
  await new Promise((r) => setTimeout(r, 300));
  await fig.screenshot({ path: `${OUT}${slug}.png` });
  console.log(`ok   ${slug}`);
  done++;
}
await browser.close();
console.log(`${done} rendered, ${skipped} skipped → ${OUT}`);
