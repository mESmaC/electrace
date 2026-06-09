"use client";
// Mounted once in the root layout: installs the localStorage→server mirror, hydrates localStorage
// from the durable stores, and reconciles the account's cloud designs (both directions — pulls
// newer server copies, imports pre-account local work). Renders nothing.
import { useEffect } from "react";
import { installMirror, pullAll, rawWrite } from "@/lib/serverSync";
import { reconcileDesigns } from "@/lib/designsSync";

export default function ServerSync() {
  useEffect(() => {
    installMirror();
    void (async () => {
      const wrote = await pullAll();
      const pulled = await reconcileDesigns(rawWrite);
      // tell open views their localStorage just changed underneath them
      if (pulled && !wrote) { try { window.dispatchEvent(new Event("electrace:hydrated")); } catch { /* ignore */ } }
    })();
  }, []);
  return null;
}
