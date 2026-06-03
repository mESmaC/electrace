"use client";
import { useEffect, useState } from "react";
import { telemetryEnabled, setTelemetry, getEvents, clearEvents } from "@/lib/telemetry";

/** Opt-in capture control: toggles local event capture and lets you inspect/export/clear it. */
export default function TelemetryToggle() {
  const [on, setOn] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => { setOn(telemetryEnabled()); setCount(getEvents().length); };
    sync();
    window.addEventListener("electrace:telemetry", sync);
    return () => window.removeEventListener("electrace:telemetry", sync);
  }, []);

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(getEvents(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "electrace-events.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[#54607a] bg-[#454e62] px-2 py-1 text-[11px]">
      <button onClick={() => setTelemetry(!on)} title="Capture anonymized editor events locally (opt-in, never sent anywhere)"
        className="flex items-center gap-1.5 text-white hover:text-white">
        <span className={`inline-block h-2 w-2 rounded-full ${on ? "bg-[#46dca6]" : "bg-[#677494]"}`} />
        Capture {on ? "on" : "off"}
      </button>
      {on && count > 0 && (
        <>
          <span className="text-[#9aa3b5]">· {count}</span>
          <button onClick={exportEvents} className="text-[#4c8dff] hover:underline">export</button>
          <button onClick={clearEvents} className="text-[#9aa3b5] hover:text-white">clear</button>
        </>
      )}
    </div>
  );
}
