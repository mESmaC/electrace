// Shorts frame renderer: drives the /shorts-stage/<slug> page frame-by-frame through a timeline
// and pipes PNG frames into ffmpeg. Deterministic — the stage renders pure state, never time.
// Usage: node render.mjs <slug> <timeline.json> <out.mp4> [baseUrl]
import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
import { readFileSync } from "fs";

const [slug, timelinePath, outPath, base = "http://localhost:3600", audioPath] = process.argv.slice(2);
const FPS = 30;
const tl = JSON.parse(readFileSync(timelinePath, "utf8")); // { duration, tracks: [...] } — see stateAt

// timeline → FrameState at time t. Tracks: {from,to,set:{...}} static sets, plus tweens:
// {from,to,tween:"wireProgress"|"symbolsShown",start,end} interpolated linearly over [from,to].
function stateAt(t) {
  const s = {};
  for (const tr of tl.tracks) {
    if (t < tr.from || t >= (tr.to ?? Infinity)) continue;
    if (tr.set) Object.assign(s, tr.set);
    if (tr.tween) {
      const f = Math.min(1, Math.max(0, (t - tr.from) / ((tr.to ?? tr.from + 1) - tr.from)));
      s[tr.tween] = tr.start + (tr.end - tr.start) * f;
    }
  }
  return s;
}

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(`${base}/shorts-stage/${slug}`, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForFunction("window.__stageReady === true", { timeout: 60000 });
const meta = await page.evaluate(() => window.__stageMeta);
console.log(`[stage] ${slug}: ${meta.wires} wires, ${meta.symbols} symbols`);

// Fedora ffmpeg has no libx264; libopenh264 is present and YouTube re-encodes anyway — feed it high bitrate.
const ffArgs = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  ...(audioPath ? ["-i", audioPath] : []),
  "-c:v", "libopenh264", "-b:v", "10M", "-pix_fmt", "yuv420p",
  ...(audioPath ? ["-c:a", "aac", "-b:a", "192k"] : []),
  outPath];
const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "ignore", "inherit"] });
let ffDead = false;
ff.on("exit", (c) => { if (c !== 0) { ffDead = true; console.error(`[ffmpeg] exited ${c}`); } });
ff.stdin.on("error", () => { ffDead = true; });

const frames = Math.round(tl.duration * FPS);
for (let i = 0; i < frames; i++) {
  if (ffDead) { console.error("[render] aborting — ffmpeg died"); process.exit(1); }
  const st = stateAt(i / FPS);
  await page.evaluate((s) => window.__frame(s), st);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 60 === 0) console.log(`[render] frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`[done] ${outPath}`);
