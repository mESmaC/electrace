// Browser-safe stand-in for `marked`, aliased in tsup for the design-system bundle.
// The real marked references the Node `process` global at module-eval, which throws in the
// design IIFE (no process). AssistantBubble only calls marked.parse() on actual assistant
// message text — previews/designs render the greeting/plain content — so a passthrough that
// escapes HTML and honors line breaks keeps the bubble fully renderable without bundling marked.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const parse = (src?: string): string => escapeHtml(String(src ?? "")).replace(/\r?\n/g, "<br>");
export const marked = { parse };
export default { parse };
