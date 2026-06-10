// Build one short: ElevenLabs (River) narration with per-character timestamps -> word-synced
// caption track + animation cues anchored to spoken words -> timeline JSON + MP3 for render.mjs.
// Usage: node build-short.mjs <config.mjs> (config default-exports {slug,title,script,anchors,...})
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const KEY = readFileSync(".env", "utf8").match(/ELEVENLABS_API_KEY=(\S+)/)[1];
const VOICE = "SAz9YHcvj6GT2YYXdXww"; // River — chosen 2026-06-10
const cfg = (await import(resolve(process.argv[2]))).default;

// Pronunciation layer: EE text reads fine but speaks wrong ("VBUS" -> letters). Substitutions
// apply to the WHOLE pipeline (TTS, captions, anchors) so character alignment stays exact.
// Per-config `pronounce` extends/overrides the defaults.
const PRONOUNCE = { "VBUS": "V-Bus", "GPIO": "G-P-I-O", "PCB": "P-C-B", ...(cfg.pronounce ?? {}) };
const speakable = (t) => Object.entries(PRONOUNCE).reduce((acc, [k, v]) => acc.split(k).join(v), t);
cfg.script = speakable(cfg.script);

// --- 1. TTS with timestamps ---
const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": KEY, "content-type": "application/json" },
  body: JSON.stringify({ text: cfg.script, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.04 } }),
});
if (!r.ok) { console.error("TTS failed:", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const data = await r.json();
writeFileSync(`out/${cfg.slug}.mp3`, Buffer.from(data.audio_base64, "base64"));
const al = data.alignment; // char-aligned to the INPUT text (normalized_alignment realigns to spoken form)
const chars = al.characters, starts = al.character_start_times_seconds, ends = al.character_end_times_seconds;
const audioEnd = ends[ends.length - 1];
console.log(`[tts] ${audioEnd.toFixed(1)}s of narration`);

// time of a script substring (first occurrence) — anchor animation cues to spoken words
const at = (needle) => {
  needle = speakable(needle);
  const i = cfg.script.indexOf(needle);
  if (i < 0) { console.warn(`[anchor] not found: ${needle}`); return 0; }
  return starts[i] ?? 0;
};
const endOf = (needle) => {
  needle = speakable(needle);
  const i = cfg.script.indexOf(needle);
  return i < 0 ? 0 : (ends[Math.min(i + needle.length - 1, ends.length - 1)] ?? 0);
};

// --- 2. captions: group words into chunks (break on punctuation or 5 words) ---
const words = [];
for (const m of cfg.script.matchAll(/\S+/g)) words.push({ text: m[0], from: m.index, to: m.index + m[0].length - 1 });
const chunks = [];
let cur = [];
for (const w of words) {
  cur.push(w);
  if (/[.?!…—:]$/.test(w.text.replace(/["']$/, "")) || cur.length >= 5) { chunks.push(cur); cur = []; }
}
if (cur.length) chunks.push(cur);
const ctaT = cfg.ctaAnchor ? at(cfg.ctaAnchor) : audioEnd;
const captionTracks = chunks.map((c) => {
  const from = starts[c[0].from] ?? 0;
  const to = (ends[c[c.length - 1].to] ?? from) + 0.12;
  return { from, to: Math.min(to, ctaT), set: { caption: c.map((w) => w.text).join(" ") } };
}).filter((t) => t.from < ctaT - 0.05);

// --- 3. timeline ---
const duration = +(audioEnd + (cfg.tailSeconds ?? 1.2)).toFixed(2);
// zoom sugar: zoomIn(t, ref, k) + zoomOut(t) emit the paired camK/camU tweens + focus + whoosh
const sfxEvents = [];
const Z = 0.38; // zoom tween duration
const helpers = {
  at, endOf, ctaT, audioEnd,
  zoomIn: (t, ref, k = 2.1) => {
    sfxEvents.push({ t, sound: "whoosh" });
    return [
      { from: t, to: ctaT, set: { focus: ref } },
      { from: t, to: t + Z, tween: "camK", start: 1, end: k },
      { from: t + Z, to: ctaT, set: { camK: k } },
      { from: t, to: t + Z, tween: "camU", start: 0, end: 1 },
      { from: t + Z, to: ctaT, set: { camU: 1 } },
    ];
  },
  refocus: (t, ref) => { sfxEvents.push({ t, sound: "pop" }); return [{ from: t, to: ctaT, set: { focus: ref } }]; },
  zoomOut: (t) => {
    sfxEvents.push({ t, sound: "whoosh" });
    return [
      { from: t, to: t + Z, tween: "camK", start: 2.1, end: 1 },
      { from: t, to: t + Z, tween: "camU", start: 1, end: 0 },
      { from: t + Z, to: ctaT, set: { camK: 1, camU: 0, focus: "" } },
    ];
  },
  sfx: (t, sound) => { sfxEvents.push({ t, sound }); return []; },
};
const tracks = [
  { from: 0, to: ctaT, set: { title: cfg.title } },
  ...(cfg.tracks ? cfg.tracks(helpers) : []),
  ...captionTracks,
  { from: ctaT, to: duration, set: { cta: true } },
];
// later tracks override earlier ones in stateAt (Object.assign order) — zoom "hold" sets must not
// fight: keep camera tracks BEFORE captions (captions never touch camera fields). sfx into timeline.
writeFileSync(`timelines/${cfg.slug}.json`, JSON.stringify({ duration, tracks, sfx: sfxEvents }, null, 1));
console.log(`[timeline] timelines/${cfg.slug}.json — ${duration}s, ${tracks.length} tracks`);
