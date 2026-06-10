// Post the link comment on a published video (pinning has NO API — pin it with one tap in the app).
// Usage: node comment.mjs <videoId> [text]
import { readFileSync } from "fs";
const env = readFileSync(".env", "utf8");
const get = (k) => env.match(new RegExp(`${k}=(\\S+)`))?.[1];
const [videoId, text = "Design it yourself — free, in your browser: https://www.electrace.net"] = process.argv.slice(2);

const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: get("YT_CLIENT_ID"), client_secret: get("YT_CLIENT_SECRET"), refresh_token: get("YT_REFRESH_TOKEN"), grant_type: "refresh_token" }),
})).json();

const r = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
  method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
  body: JSON.stringify({ snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } } }),
});
console.log(r.ok ? "Comment posted — pin it in the app." : `Failed: ${r.status} ${await r.text()}`);
