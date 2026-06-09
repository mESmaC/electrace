// drizzle-kit config — schema lives in db/schema.ts, SQL in db/migrations/. `npx drizzle-kit push`
// applies the schema once DATABASE_URL (the Supabase Postgres connection string) is in .env.local;
// until then, db/migrations/0001_init.sql can be pasted straight into the Supabase SQL editor.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
