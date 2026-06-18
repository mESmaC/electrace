import { useEffect } from "react";
import { AssistantBubble } from "@electrace/ui";

/** Sparky's open chat pane — the branded gradient assistant over a canvas. The pane is
 *  absolutely positioned, so it renders inside a `relative` container; we open it on mount via
 *  the same `electrace:sparky-ask` window event the app's BOM panel uses. */
export const Open = () => {
  // Child effects (AssistantBubble's window listener) run before this parent effect, so the
  // dispatch lands after the listener is registered — opening the pane to Sparky's greeting.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("electrace:sparky-ask", { detail: {} }));
  }, []);
  return (
    <div
      data-theme="mid"
      style={{ position: "relative", height: 560, width: 440, background: "var(--color-bg)", overflow: "hidden", borderRadius: 12, border: "1px solid var(--color-border)" }}
    >
      <AssistantBubble />
    </div>
  );
};
