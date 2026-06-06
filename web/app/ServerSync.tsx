"use client";
// Mounted once in the root layout: installs the localStorage→server mirror, then hydrates
// localStorage from the durable server store. Renders nothing.
import { useEffect } from "react";
import { installMirror, pullAll } from "@/lib/serverSync";

export default function ServerSync() {
  useEffect(() => {
    installMirror();
    void pullAll();
  }, []);
  return null;
}
