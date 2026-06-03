import Editor from "./Editor";
import { loadDesign, blockLibrary } from "@/lib/blocks";

export const metadata = { title: "Editor — Electrace" };

// Server component: load the design + block library (from disk), hand them to the
// client editor, which runs the core's analyze() live in the browser.
export default function EditorPage() {
  const design = loadDesign("buck-supply");
  const blocks = blockLibrary();
  return <Editor design={design} blocks={blocks} />;
}
