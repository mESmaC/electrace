// Harvest [VERIFY] entries from bug_reports into markdown for VERIFICATION.md.
// Cameron's in-product verification workflow: while testing in the editor, hit Report Bug
// and write "[VERIFY] [P|F] <what was tested>" — the capture buffer (last 300 events) and a
// design snapshot ride along as evidence. This script pulls them back out.
//
//   cd web && node --env-file=.env.local scripts/verify-report.mjs           # all [VERIFY] rows
//   cd web && node --env-file=.env.local scripts/verify-report.mjs --since 2026-06-11
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("need NEXT_PUBLIC_SUPABASE_URL + service key in env (.env.local)"); process.exit(1); }

const sinceIdx = process.argv.indexOf("--since");
const since = sinceIdx > -1 ? process.argv[sinceIdx + 1] : null;

const sb = createClient(url, key);
let q = sb.from("bug_reports")
  .select("created_at, email, description, events, meta")
  .ilike("description", "[VERIFY]%")
  .order("created_at", { ascending: true });
if (since) q = q.gte("created_at", since);
const { data, error } = await q;
if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log("(no [VERIFY] entries" + (since ? ` since ${since}` : "") + ")"); process.exit(0); }

let pass = 0, fail = 0;
for (const r of data) {
  const m = r.description.match(/^\[VERIFY\]\s*\[(P|F)\]\s*([\s\S]*)$/i);
  const verdict = m ? m[1].toUpperCase() : "?";
  const body = (m ? m[2] : r.description).trim().replace(/\s+/g, " ");
  if (verdict === "P") pass++; else if (verdict === "F") fail++;
  const day = r.created_at.slice(0, 10);
  const ev = Array.isArray(r.events) ? `${r.events.length} events captured` : "no capture";
  const where = r.meta?.url ?? "";
  console.log(`- ${verdict === "P" ? "✅" : verdict === "F" ? "❌" : "❓"} ${day} ${where} — ${body}  *(${ev})*`);
}
console.log(`\n${pass} pass · ${fail} fail · ${data.length - pass - fail} unparsed of ${data.length}`);
