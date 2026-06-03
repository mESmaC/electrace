"use client";
import { useSymbolStyle, setSymbolStyle, type SymStyle } from "./symbols";

/** Global ANSI/IEC symbol-standard switch. Persisted; every symbol everywhere re-renders live. */
export default function SymbolStyleToggle() {
  const style = useSymbolStyle();
  return (
    <div className="flex overflow-hidden rounded-md border border-[#54607a] text-[10px]" title="Schematic symbol standard — applies everywhere">
      {(["ansi", "iec"] as SymStyle[]).map((st) => (
        <button key={st} onClick={() => setSymbolStyle(st)}
          className={`px-2 py-1 uppercase ${style === st ? "bg-[#4c8dff] text-white" : "text-[#9aa3b5] hover:text-white"}`}>{st}</button>
      ))}
    </div>
  );
}
