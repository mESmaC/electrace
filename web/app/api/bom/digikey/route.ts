// Push a BOM to a Digi-Key myList: forwards to Digi-Key's no-auth third-party endpoint
// (server-side, so the browser never fights CORS) and returns the single-use URL that drops the
// parts into a cart / saves the list. Spec: forum.digikey.com thread 61445 — POST
// /mylists/api/thirdparty?listName=… with [{ requestedPartNumber, referenceDesignator,
// quantities: [{quantity}] }] → { singleUseUrl }.
const ENDPOINT = "https://www.digikey.com/mylists/api/thirdparty";

type PartIn = { pn?: string; ref?: string; qty?: number; note?: string };

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { name?: string; parts?: PartIn[] };
  const parts = (b.parts ?? []).filter((p) => typeof p.pn === "string" && p.pn.trim()).slice(0, 200);
  if (!parts.length) return Response.json({ error: "No orderable parts (rows need a part number)." }, { status: 400 });

  const name = (b.name ?? "Electrace BOM").toString().slice(0, 60);
  const body = parts.map((p) => ({
    requestedPartNumber: p.pn!.trim(),
    ...(p.ref ? { referenceDesignator: String(p.ref).slice(0, 100) } : {}),
    ...(p.note ? { notes: String(p.note).slice(0, 200) } : {}),
    quantities: [{ quantity: Math.max(1, Math.min(10_000, Math.floor(Number(p.qty) || 1))) }],
  }));

  try {
    const r = await fetch(`${ENDPOINT}?listName=${encodeURIComponent(name)}`, {
      method: "POST",
      // a browser-like UA + Accept: this is the no-auth endpoint a browser hits, and the host sits
      // behind bot-protection that can 403 a bare server fetch (separate from a bad part number).
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = (await r.text().catch(() => "")).slice(0, 300);
      console.error("[bom] digikey mylists:", r.status, text);
      // a Cloudflare/bot challenge (403 + HTML interstitial) is a different failure than Digi-Key
      // rejecting a part number — say so, so the message isn't misleading.
      const challenged = r.status === 403 || /just a moment|cf-|cloudflare/i.test(text);
      return Response.json({
        error: challenged
          ? "Digi-Key blocked the request right now — try again in a moment, or use the buy links."
          : "Digi-Key didn't accept the list — one of the part numbers may not be orderable.",
      }, { status: 502 });
    }
    // live behavior (verified 2026-06-09): the body is a bare JSON string with a short URL;
    // the forum docs describe { singleUseUrl } — accept either shape
    const out = (await r.json()) as string | { singleUseUrl?: string };
    const url = typeof out === "string" ? out : out?.singleUseUrl;
    if (!url || !/^https:\/\/www\.digikey\./.test(url)) return Response.json({ error: "Digi-Key didn't return a list link." }, { status: 502 });
    return Response.json({ url });
  } catch (e) {
    console.error("[bom] digikey mylists:", e);
    return Response.json({ error: "Couldn't reach Digi-Key." }, { status: 502 });
  }
}
