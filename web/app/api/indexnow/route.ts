// IndexNow: instant indexing for Bing (and Yandex/Naver/Seznam — DuckDuckGo reads Bing's index).
// The key is PUBLIC by design — engines validate by fetching /<key>.txt from this host. Hitting
// GET /api/indexnow submits every sitemap URL; call it after deploys that add/change pages.
import { listBlocks } from "@/lib/blocks";
import { COMPARISONS } from "@/lib/comparisons";
import { SITE } from "@/lib/site";

const KEY = "f03945dcc9324f95a83d600f076fbb74";

let lastSubmit = 0; // per-instance cooldown — this is a manual "ping after deploy" endpoint, not an API
export async function GET() {
  if (Date.now() - lastSubmit < 60 * 60 * 1000) {
    return Response.json({ ok: false, error: "cooldown — try again later" }, { status: 429 });
  }
  lastSubmit = Date.now();
  const urls = [
    `${SITE}/`, `${SITE}/blocks`, `${SITE}/pricing`, `${SITE}/help`, `${SITE}/vs`,
    ...listBlocks().map((b) => `${SITE}/blocks/${b.slug}`),
    ...COMPARISONS.map((c) => `${SITE}/vs/${c.slug}`),
  ];
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
    });
    return Response.json({ submitted: urls.length, status: r.status });
  } catch {
    return Response.json({ error: "IndexNow unreachable" }, { status: 502 });
  }
}
