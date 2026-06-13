// Bench cost recovery: pulls sparky_usage for a model + window, groups runs into TASKS by
// time gap (>3 min idle = next task), prints a per-task cost table + the MODEL-BENCH.md row.
// Usage: node --env-file=.env.local scripts/bench-cost.mjs <model-substring> [hours-back=6]
// (same .env.local service-key pattern as verify-report.mjs)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }

const model = process.argv[2] ?? "";
const hoursBack = Number(process.argv[3] ?? 6);
const sb = createClient(url, key);

const since = new Date(Date.now() - hoursBack * 3600_000).toISOString();
const { data, error } = await sb
  .from("sparky_usage")
  .select("model, in_full, in_cached, in_write, out_tokens, cost_usd, created_at")
  .gte("created_at", since)
  .ilike("model", `%${model}%`)
  .order("created_at", { ascending: true });
if (error) { console.error(error.message); process.exit(1); }
if (!data?.length) { console.log(`No ${model || "any"} runs in the last ${hoursBack} h.`); process.exit(0); }

const GAP_MS = 3 * 60_000;
const tasks = [];
for (const r of data) {
  const t = new Date(r.created_at).getTime();
  const cur = tasks[tasks.length - 1];
  if (!cur || t - cur.last > GAP_MS) tasks.push({ first: t, last: t, runs: [r] });
  else { cur.last = t; cur.runs.push(r); }
}

const usd = (rows) => rows.reduce((a, r) => a + Number(r.cost_usd), 0);
const tok = (rows, k) => rows.reduce((a, r) => a + Number(r[k]), 0);
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

console.log(`${data[0].model} — ${data.length} runs, ${tasks.length} task groups (gap > 3 min splits)\n`);
console.log("task  start  runs   in(full)  in(cached)   out      $");
tasks.forEach((g, i) => {
  console.log(
    `T${String(i + 1).padEnd(4)}${hhmm(g.first)}  ${String(g.runs.length).padEnd(5)}` +
    `${String(tok(g.runs, "in_full")).padStart(9)}  ${String(tok(g.runs, "in_cached")).padStart(10)}` +
    `${String(tok(g.runs, "out_tokens")).padStart(7)}  ${usd(g.runs).toFixed(4)}`,
  );
});
const total = usd(data);
console.log(`\nTOTAL: $${total.toFixed(4)} for the full bench`);
console.log(`\nMODEL-BENCH row fragment:  | ${data[0].model} | … | $${total.toFixed(2)} |`);
