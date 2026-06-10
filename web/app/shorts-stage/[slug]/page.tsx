// Render stage for the Shorts generator (driven by shorts/render.mjs). Not user-facing;
// excluded from indexing via robots (the /shorts-stage prefix is disallowed).
import { notFound } from "next/navigation";
import { loadBlock } from "@/lib/blocks";
import Stage from "./Stage";

export default async function StagePage({ params }: { params: Promise<{ slug: string }> }) {
  let b;
  try { b = loadBlock((await params).slug); } catch { notFound(); }
  if (!b?.block.layout) notFound();
  return <Stage layout={b.block.layout} />;
}
