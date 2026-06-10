// One-time OAuth for the channel: opens Google's consent page, catches the redirect on a local
// loopback server, and stores the refresh token in .env. Re-run only if access is revoked.
// Prereqs (user, in Google Cloud Console): project + YouTube Data API v3 enabled + OAuth consent
// screen (External, yourself as test user) + an OAuth client of type "Desktop app".
import { readFileSync, appendFileSync } from "fs";
import { createServer } from "http";

const env = readFileSync(".env", "utf8");
const get = (k) => env.match(new RegExp(`${k}=(\\S+)`))?.[1];
const ID = get("YT_CLIENT_ID"), SECRET = get("YT_CLIENT_SECRET");
if (!ID || !SECRET) { console.error("Add YT_CLIENT_ID= and YT_CLIENT_SECRET= to shorts/.env first (Google Cloud Console → Credentials → OAuth client, Desktop app)."); process.exit(1); }

const PORT = 8089;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl";
const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

console.log("\nOpen this in a browser (logged into the CHANNEL's Google account):\n\n" + url + "\n\nWaiting for the redirect…");
const code = await new Promise((resolve) => {
  const srv = createServer((req, res) => {
    const c = new URL(req.url, REDIRECT).searchParams.get("code");
    res.end(c ? "Authorized — you can close this tab." : "No code in redirect.");
    if (c) { srv.close(); resolve(c); }
  }).listen(PORT);
});

const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: ID, client_secret: SECRET, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
});
const tok = await r.json();
if (!tok.refresh_token) { console.error("No refresh token returned:", tok); process.exit(1); }
appendFileSync(".env", `\nYT_REFRESH_TOKEN=${tok.refresh_token}\n`);
console.log("Refresh token stored in shorts/.env — uploads are now authorized.");
