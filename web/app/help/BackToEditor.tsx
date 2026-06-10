"use client";
// Shows "back to the editor" ONLY when the help link was followed from the editor (?from=editor).
// Client-side so /help itself stays statically rendered.
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner() {
  const from = useSearchParams().get("from");
  if (from !== "editor") return null;
  return <Link href="/editor" className="text-faint hover:text-dim">← Back to the editor</Link>;
}
export default function BackToEditor() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
