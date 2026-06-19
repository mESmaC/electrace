// IndexNow: instant indexing for Bing (and Yandex/Naver/Seznam — DuckDuckGo reads Bing's index).
// The key is PUBLIC by design — engines validate by fetching /<key>.txt from this host. Hitting
// GET /api/indexnow submits every sitemap URL; call it after deploys that add/change pages.
import { listBlocks } from "@/lib/blocks";
import { COMPARISONS } from "@/lib/comparisons";
import { SITE } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/admin";

const KEY = "b660c34debc34c088f58efee3a15032d";

let lastSubmit = 0; // per-instance cooldown — this is a manual "ping after deploy" endpoint, not an API
export async function GET() {
  if (Date.now() - lastSubmit < 60 * 60 * 1000) {
    return Response.json({ ok: false, error: "cooldown — try again later" }, { status: 429 });
  }
  lastSubmit = Date.now();
  // public user designs — push them to Bing/DuckDuckGo so each becomes discoverable on deploy
  let shareUrls: string[] = [];
  try {
    const admin = supabaseAdmin();
    if (admin) {
      const { data } = await admin.from("designs").select("id").eq("visibility", "public").limit(5000);
      shareUrls = (data ?? []).map((d: { id: string }) => `${SITE}/share/${d.id}`);
    }
  } catch { /* skip share URLs if the lookup fails — never block the static submit */ }
  const urls = [
    `${SITE}/`, `${SITE}/blocks`, `${SITE}/pricing`, `${SITE}/help`, `${SITE}/vs`,
    ...listBlocks().map((b) => `${SITE}/blocks/${b.slug}`),
    ...COMPARISONS.map((c) => `${SITE}/vs/${c.slug}`),
    ...shareUrls,
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
