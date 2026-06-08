import Editor from "./Editor";
import RequireAuth from "../RequireAuth";
import { loadDesign, blockLibrary } from "@/lib/blocks";
import type { Design } from "@electrace/core";

export const metadata = { title: "Editor — Electrace" };

// Server component: load the block library (from disk) and hand it to the client editor.
// A project's design content lives in the browser (localStorage), so for `?p=<id>` we SSR an
// empty stub with that id and let the client hydrate it; without a project, use the bundled sample.
export default async function EditorPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const blocks = blockLibrary();
  const pid = (await searchParams)?.p;
  const projectId = typeof pid === "string" ? pid : undefined;
  const design: Design = projectId
    ? { id: projectId, name: "Untitled project", visibility: "private", blocks: [], connections: [] }
    : loadDesign("buck-supply");
  return <RequireAuth><Editor design={design} blocks={blocks} projectId={projectId} /></RequireAuth>;
}
