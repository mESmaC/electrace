import type { CheckDoc, CheckSeverity } from "@/lib/checkDocs";

export const SEV_LABEL: Record<CheckSeverity, string> = {
  error: "error", warn: "warning", info: "info", recommendation: "recommendation", unknown: "unknown",
};
const SEV_CLS: Record<CheckSeverity, string> = {
  error: "text-[#e2837e] border-[#e2837e]/45 bg-[#e2554b]/10",
  warn: "text-amber border-amber/45 bg-amber/10",
  info: "text-dim border-border bg-surface-2",
  recommendation: "text-accent border-accent/40 bg-accent/10",
  unknown: "text-faint border-border bg-surface-2",
};
const SEV_ICON: Record<CheckSeverity, string> = { error: "✕", warn: "▲", info: "ℹ", recommendation: "💡", unknown: "○" };

export function SevChip({ sev }: { sev: CheckSeverity }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${SEV_CLS[sev]}`}>{SEV_ICON[sev]} {SEV_LABEL[sev]}</span>;
}

export const CATEGORY_ORDER: CheckDoc["category"][] = ["voltage", "current", "connectivity", "thermal", "polarity", "completeness", "debug"];
export const CATEGORY_TITLES: Record<CheckDoc["category"], string> = {
  voltage: "Voltage", current: "Current & power", connectivity: "Connectivity & buses",
  thermal: "Thermal", polarity: "Polarity", completeness: "Completeness & engine honesty", debug: "Debuggability",
};
