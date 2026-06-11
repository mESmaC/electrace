import Editor from "./Editor";
import { loadDesign, blockLibrary } from "@/lib/blocks";
import type { Design } from "@electrace/core";

export const metadata = { title: "Editor — Electrace", description: "Design circuits from self-explaining blocks with live electrical checks — free, in your browser, no account needed." };

// Server component: load the block library (from disk) and hand it to the client editor.
// A project's design content lives in the browser (localStorage), so for `?p=<id>` we SSR an
// empty stub with that id and let the client hydrate it; without a project, use the bundled sample.
export default async function EditorPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const blocks = blockLibrary();
  const pid = (await searchParams)?.p;
  const projectId = typeof pid === "string" ? pid : undefined;
  const design: Design = projectId
    ? { id: projectId, name: "Untitled project", visibility: "unlisted", blocks: [], connections: [] }
    : loadDesign("buck-supply");
  // No auth gate: anonymous users get the sandbox (the app is local-first already — work lives in
  // this browser, the in-editor banner explains, and signing up imports it). Cloud APIs still 401.
  return <Editor design={design} blocks={blocks} projectId={projectId} />;
}
