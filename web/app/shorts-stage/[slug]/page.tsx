// Render stage for the Shorts generator (driven by shorts/render.mjs). Not user-facing;
// robots disallows /shorts-stage/. ?scenes=block,ne555,comparator builds a multi-scene
// teardown stage: "block" = the block's own layout, anything else = that IC's discrete
// equivalent from the core library.
import { notFound } from "next/navigation";
import { discreteEquivalentFor, type SchematicLayout } from "@electrace/core";
import { loadBlock } from "@/lib/blocks";
import Stage from "./Stage";

export default async function StagePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ scenes?: string }> }) {
  let b;
  try { b = loadBlock((await params).slug); } catch { notFound(); }
  if (!b?.block.layout) notFound();
  const names = ((await searchParams).scenes ?? "block").split(",").map((x) => x.trim()).filter(Boolean);
  const scenes: { layout: SchematicLayout }[] = [];
  for (const n of names) {
    if (n === "block") { scenes.push({ layout: b.block.layout }); continue; }
    const eq = discreteEquivalentFor(n);
    if (!eq?.layout) notFound();
    scenes.push({ layout: eq.layout });
  }
  return <Stage scenes={scenes} />;
}
