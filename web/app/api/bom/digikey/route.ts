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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("[bom] digikey mylists:", r.status, (await r.text().catch(() => "")).slice(0, 200));
      return Response.json({ error: "Digi-Key didn't accept the list — try again in a moment." }, { status: 502 });
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
