# Shorts pipeline

Render: `node build-short.mjs configs/<slug>.mjs` (TTS + timeline) → start the web dev server →
`node render.mjs <slug> timelines/<slug>.json out/<slug>.mp4 http://localhost:PORT out/<slug>.mp3`

## Upload automation (YouTube Data API)

One-time setup (user):
1. console.cloud.google.com → new project → enable **YouTube Data API v3**
2. OAuth consent screen: External, add yourself as test user
3. Credentials → Create OAuth client → **Desktop app** → put `YT_CLIENT_ID=` / `YT_CLIENT_SECRET=` in `shorts/.env`
4. `node auth.mjs` → browser consent with the channel account → refresh token saved
5. **File the YouTube API audit form** (search "YouTube API Services audit form") — until the
   project is verified, API uploads are LOCKED PRIVATE by YouTube policy. Single-channel,
   own-content automation is routinely approved. Manual Studio uploads bridge the gap.

Per video: `node upload.mjs out/<slug>.mp4 meta/<slug>.json` (private draft, or scheduled via
`publishAt`). After it publishes: `node comment.mjs <videoId>` posts the link comment — pinning
is manual (no API exists for it).

Quota: uploads cost 1600 of 10,000 daily units → 6/day ceiling, we use ≤2.
