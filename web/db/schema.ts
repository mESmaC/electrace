// Drizzle schema — the P1 storage layer from storage.md: users + designs. Blocks stay file-based
// until P2. Postgres + JSONB: the design graph is stored whole (it's exactly what the editor holds);
// relational metadata (owner, visibility, timestamps) wraps it for querying.
//
// Deliberate deviation from storage.md: `designs.id` is TEXT (the client-generated `proj-…` id),
// not a uuid. The editor mints ids offline-first; making the server adopt them means autosave,
// import, and reconciliation are all a plain upsert by id — no local↔server id mapping table,
// no "pending id" states. Public URLs get a separate slug later (P2).
//
// Access control is Row-Level Security (see the migration SQL): every query runs as the signed-in
// user via the Supabase session, and Postgres itself enforces
//   read:   visibility in ('public','unlisted') OR owner_id = auth.uid()
//   write:  owner_id = auth.uid()  (and private requires plan = 'pro')
// The API routes repeat the same checks for friendlier errors; RLS is the backstop that makes a
// route bug a 0-row result instead of a data leak.
import { pgTable, text, uuid, jsonb, timestamp, index, bigint, numeric } from "drizzle-orm/pg-core";

/** Mirror of auth.users we own: plan + settings live here (auth.users is Supabase's). A trigger
 *  inserts this row on signup; `plan` is what billing will flip (entitlements.ts reads it at P3 —
 *  today it still falls back to the SPARKY_PRO_EMAILS allowlist). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull(),
  name: text("name"),
  plan: text("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"), // set by the billing webhook on first checkout
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const designs = pgTable("designs", {
  id: text("id").primaryKey(), // client-generated ("proj-…"); see header note
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull().default("Untitled project"),
  // public = indexed/SEO surface · unlisted = link-shareable (the free default) · private = Pro
  visibility: text("visibility", { enum: ["public", "unlisted", "private"] }).notNull().default("unlisted"),
  graph: jsonb("graph").notNull(), // the core Design shape (blocks, connections, connectors, acks)
  pcb: jsonb("pcb"), // the board layout (placements/traces/outline) — saved with the design, not beside it
  meta: jsonb("meta").notNull().default({}), // dashboard extras: { lint: {error,warn}, starred }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("designs_owner_idx").on(t.ownerId), index("designs_visibility_idx").on(t.visibility)]);

/** Durable per-user KV — everything the localStorage mirror holds that isn't a design (user
 *  blocks, block-schematic drafts, settings, project index). Values are JSON strings verbatim.
 *  RLS: owner-only. Backs /api/store for signed-in users; the /tmp file store remains the
 *  anonymous/local fallback. */
export const userKv = pgTable("user_kv", {
  ownerId: uuid("owner_id").notNull(),
  k: text("k").notNull(),
  v: text("v").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("user_kv_owner_idx").on(t.ownerId)]);

/** Sparky usage metering — one append-only row per assistant run. Sums per owner per month drive
 *  the fair-use budget gate (env SPARKY_MONTHLY_BUDGET_USD; unset = unlimited). RLS: owner-only. */
export const sparkyUsage = pgTable("sparky_usage", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ownerId: uuid("owner_id").notNull(),
  model: text("model").notNull(),
  inFull: bigint("in_full", { mode: "number" }).notNull().default(0),
  inCached: bigint("in_cached", { mode: "number" }).notNull().default(0),
  inWrite: bigint("in_write", { mode: "number" }).notNull().default(0),
  outTokens: bigint("out_tokens", { mode: "number" }).notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sparky_usage_owner_time_idx").on(t.ownerId, t.createdAt)]);

/** Bug reports — inserted only by /api/feedback (service role) on the user's explicit send.
 *  RLS enabled with no policies: invisible to the public API. */
export const bugReports = pgTable("bug_reports", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  email: text("email"),
  description: text("description").notNull(),
  events: jsonb("events"),
  design: jsonb("design"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
