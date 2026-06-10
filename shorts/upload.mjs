// Upload + schedule one short via the YouTube Data API (resumable upload, publishAt scheduling).
// Usage: node upload.mjs <video.mp4> <meta.json>
//   meta.json: { title, description, tags: [], publishAt: "2026-06-15T19:00:00Z" }  (publishAt optional → private draft)
// NOTE: until the API project passes YouTube's audit, public/scheduled visibility may be LOCKED
// by YouTube on API uploads. Test with a private draft first; file the audit form to lift it.
import { readFileSync, statSync, createReadStream } from "fs";

const env = readFileSync(".env", "utf8");
const get = (k) => env.match(new RegExp(`${k}=(\\S+)`))?.[1];
const [file, metaPath] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(metaPath, "utf8"));

const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: get("YT_CLIENT_ID"), client_secret: get("YT_CLIENT_SECRET"), refresh_token: get("YT_REFRESH_TOKEN"), grant_type: "refresh_token" }),
})).json();
if (!tok.access_token) { console.error("Auth failed:", tok); process.exit(1); }

const body = {
  snippet: { title: meta.title, description: meta.description ?? "", tags: meta.tags ?? [], categoryId: "28" },
  status: {
    privacyStatus: "private",
    ...(meta.publishAt ? { publishAt: meta.publishAt } : {}),
    selfDeclaredMadeForKids: false,
  },
};
const size = statSync(file).size;
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable", {
  method: "POST",
  headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json", "x-upload-content-length": String(size), "x-upload-content-type": "video/mp4" },
  body: JSON.stringify(body),
});
if (!init.ok) { console.error("Init failed:", init.status, await init.text()); process.exit(1); }
const session = init.headers.get("location");
const put = await fetch(session, { method: "PUT", headers: { "content-length": String(size), "content-type": "video/mp4" }, body: createReadStream(file), duplex: "half" });
const vid = await put.json();
if (!put.ok) { console.error("Upload failed:", put.status, vid); process.exit(1); }
console.log(`Uploaded: https://youtube.com/shorts/${vid.id}`);
console.log(`Status: ${vid.status.privacyStatus}${vid.status.publishAt ? ` — publishes ${vid.status.publishAt}` : " (draft)"}`);
if (vid.status.uploadStatus) console.log(`uploadStatus: ${vid.status.uploadStatus}`);
