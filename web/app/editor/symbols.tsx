"use client";
import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Dims, ChipSpec } from "./schematic-model";

/** Symbol standard: ANSI (zigzag resistor, US) vs IEC (boxed, international). */
export type SymStyle = "ansi" | "iec";

// A predefined schematic symbol: a drawing + pin anchor points (relative to its box).
export interface SymbolDef {
  label: string;
  w: number;
  h: number;
  defaultRef: string;
  pins: { id: string; x: number; y: number; label?: string }[];
  draw: (style?: SymStyle) => React.ReactNode; // SVG content sized to viewBox 0 0 w h
}

const W = "currentColor"; // symbol body — themed (inherits the text color), so symbols read on any theme
const A = "#4c8dff";      // leads / pins — accent, constant across themes

export const SYMBOLS: Record<string, SymbolDef> = {
  resistor: {
    label: "Resistor", w: 90, h: 28, defaultRef: "R",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 90, y: 14 }],
    draw: (style) => (
      <>
        <line x1="0" y1="14" x2="22" y2="14" stroke={A} strokeWidth="2" />
        {style === "iec"
          ? <rect x="22" y="6" width="44" height="16" fill="none" stroke={W} strokeWidth="2" />
          : <polyline points="22,14 28,5 40,23 52,5 64,23 70,14" fill="none" stroke={W} strokeWidth="2" />}
        <line x1={style === "iec" ? 66 : 70} y1="14" x2="90" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  capacitor: {
    label: "Capacitor", w: 60, h: 30, defaultRef: "C",
    pins: [{ id: "1", x: 0, y: 15 }, { id: "2", x: 60, y: 15 }],
    draw: () => (
      <>
        <line x1="0" y1="15" x2="28" y2="15" stroke={A} strokeWidth="2" />
        <line x1="28" y1="3" x2="28" y2="27" stroke={W} strokeWidth="2" />
        <line x1="36" y1="3" x2="36" y2="27" stroke={W} strokeWidth="2" />
        <line x1="36" y1="15" x2="60" y2="15" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  inductor: {
    label: "Inductor", w: 90, h: 24, defaultRef: "L",
    pins: [{ id: "1", x: 0, y: 16 }, { id: "2", x: 90, y: 16 }],
    draw: (style) => (
      <>
        <line x1="0" y1="16" x2="20" y2="16" stroke={A} strokeWidth="2" />
        {style === "iec"
          ? <rect x="20" y="10" width="48" height="12" rx="1" fill="#566177" stroke={W} strokeWidth="2" />
          : <path d="M20 16 q7 -12 14 0 q7 -12 14 0 q7 -12 14 0 q7 -12 14 0" fill="none" stroke={W} strokeWidth="2" />}
        <line x1="68" y1="16" x2="90" y2="16" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  diode: {
    label: "Diode", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="28" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="28,5 28,23 44,14" fill={W} />
        <line x1="44" y1="5" x2="44" y2="23" stroke={W} strokeWidth="2" />
        <line x1="44" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  ground: {
    label: "Ground", w: 34, h: 34, defaultRef: "GND",
    pins: [{ id: "1", x: 17, y: 0 }],
    draw: () => (
      <>
        <line x1="17" y1="0" x2="17" y2="14" stroke={A} strokeWidth="2" />
        <line x1="4" y1="14" x2="30" y2="14" stroke={W} strokeWidth="2" />
        <line x1="9" y1="21" x2="25" y2="21" stroke={W} strokeWidth="2" />
        <line x1="13" y1="28" x2="21" y2="28" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  ic: {
    label: "IC", w: 84, h: 84, defaultRef: "U",
    pins: [
      { id: "1", x: 0, y: 24 }, { id: "2", x: 0, y: 60 },
      { id: "3", x: 84, y: 24 }, { id: "4", x: 84, y: 60 },
    ],
    draw: () => (
      <>
        <line x1="0" y1="24" x2="14" y2="24" stroke={A} strokeWidth="2" />
        <line x1="0" y1="60" x2="14" y2="60" stroke={A} strokeWidth="2" />
        <line x1="70" y1="24" x2="84" y2="24" stroke={A} strokeWidth="2" />
        <line x1="70" y1="60" x2="84" y2="60" stroke={A} strokeWidth="2" />
        <rect x="14" y="10" width="56" height="64" rx="4" fill="#566177" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  led: {
    label: "LED", w: 70, h: 40, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 22 }, { id: "2", x: 70, y: 22 }],
    draw: () => (
      <>
        <line x1="0" y1="22" x2="28" y2="22" stroke={A} strokeWidth="2" />
        <polygon points="28,13 28,31 44,22" fill={W} />
        <line x1="44" y1="13" x2="44" y2="31" stroke={W} strokeWidth="2" />
        <line x1="44" y1="22" x2="70" y2="22" stroke={A} strokeWidth="2" />
        <line x1="40" y1="12" x2="50" y2="2" stroke={W} strokeWidth="1.5" />
        <polyline points="46,2 50,2 50,6" fill="none" stroke={W} strokeWidth="1.5" />
        <line x1="33" y1="15" x2="43" y2="5" stroke={W} strokeWidth="1.5" />
        <polyline points="39,5 43,5 43,9" fill="none" stroke={W} strokeWidth="1.5" />
      </>
    ),
  },
  zener: {
    label: "Zener", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="28" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="28,5 28,23 44,14" fill={W} />
        <polyline points="38,5 44,5 44,23 50,23" fill="none" stroke={W} strokeWidth="2" />
        <line x1="44" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  tvs: {
    // Unidirectional TVS (transient-voltage suppressor) — clamps one polarity, e.g. SMBJ36A.
    label: "TVS (uni)", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="20" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="20,5 20,23 36,14" fill={W} />
        <line x1="36" y1="6" x2="36" y2="22" stroke={W} strokeWidth="2" />
        <line x1="36" y1="6" x2="30" y2="6" stroke={W} strokeWidth="2" />
        <line x1="36" y1="22" x2="42" y2="22" stroke={W} strokeWidth="2" />
        <line x1="36" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  tvs_bi: {
    // Bidirectional TVS — two zeners cathode-to-cathode, clamps both polarities, e.g. SMBJ36CA.
    label: "TVS (bidir)", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="10" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="10,5 10,23 26,14" fill={W} />
        <line x1="26" y1="6" x2="26" y2="22" stroke={W} strokeWidth="2" />
        <line x1="26" y1="6" x2="21" y2="6" stroke={W} strokeWidth="2" />
        <line x1="26" y1="22" x2="31" y2="22" stroke={W} strokeWidth="2" />
        <line x1="26" y1="14" x2="44" y2="14" stroke={W} strokeWidth="2" />
        <polygon points="60,5 60,23 44,14" fill={W} />
        <line x1="44" y1="6" x2="44" y2="22" stroke={W} strokeWidth="2" />
        <line x1="44" y1="6" x2="49" y2="6" stroke={W} strokeWidth="2" />
        <line x1="44" y1="22" x2="39" y2="22" stroke={W} strokeWidth="2" />
        <line x1="60" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  "npn": {
    label: "NPN BJT", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "B", x: 0, y: 32, label: "B" }, { id: "C", x: 40, y: 2, label: "C" }, { id: "E", x: 40, y: 62, label: "E" }],
    draw: () => (
      <>
        <circle cx="28" cy="32" r="24" fill="none" stroke={W} strokeWidth="1.2" />
        <line x1="0" y1="32" x2="18" y2="32" stroke={A} strokeWidth="2" />
        <line x1="18" y1="18" x2="18" y2="46" stroke={W} strokeWidth="2" />
        <line x1="18" y1="27" x2="40" y2="14" stroke={W} strokeWidth="2" />
        <line x1="40" y1="14" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="18" y1="37" x2="40" y2="50" stroke={W} strokeWidth="2" />
        <line x1="40" y1="50" x2="40" y2="62" stroke={A} strokeWidth="2" />
        <polygon points="33,52 27,46 35,44" fill={W} />
      </>
    ),
  },
  "pnp": {
    label: "PNP BJT", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "B", x: 0, y: 32, label: "B" }, { id: "C", x: 40, y: 2, label: "C" }, { id: "E", x: 40, y: 62, label: "E" }],
    draw: () => (
      <>
        <circle cx="28" cy="32" r="24" fill="none" stroke={W} strokeWidth="1.2" />
        <line x1="0" y1="32" x2="18" y2="32" stroke={A} strokeWidth="2" />
        <line x1="18" y1="18" x2="18" y2="46" stroke={W} strokeWidth="2" />
        <line x1="18" y1="27" x2="40" y2="14" stroke={W} strokeWidth="2" />
        <line x1="40" y1="14" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="18" y1="37" x2="40" y2="50" stroke={W} strokeWidth="2" />
        <line x1="40" y1="50" x2="40" y2="62" stroke={A} strokeWidth="2" />
        <polygon points="20,34 26,40 18,42" fill={W} />
      </>
    ),
  },
  "nmos": {
    label: "N-MOSFET", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "G", x: 0, y: 32, label: "G" }, { id: "D", x: 40, y: 2, label: "D" }, { id: "S", x: 40, y: 62, label: "S" }],
    draw: () => (
      <>
        <line x1="0" y1="32" x2="14" y2="32" stroke={A} strokeWidth="2" />
        <line x1="14" y1="18" x2="14" y2="46" stroke={W} strokeWidth="2" />
        <line x1="20" y1="16" x2="20" y2="26" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="27" x2="20" y2="37" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="38" x2="20" y2="48" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="21" x2="40" y2="21" stroke={W} strokeWidth="2" />
        <line x1="40" y1="21" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="20" y1="43" x2="40" y2="43" stroke={W} strokeWidth="2" />
        <line x1="40" y1="43" x2="40" y2="62" stroke={A} strokeWidth="2" />
        <polygon points="26,32 33,29 33,35" fill={W} />
      </>
    ),
  },
  "pmos": {
    label: "P-MOSFET", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "G", x: 0, y: 32, label: "G" }, { id: "D", x: 40, y: 62, label: "D" }, { id: "S", x: 40, y: 2, label: "S" }],
    draw: () => (
      <>
        <line x1="0" y1="32" x2="14" y2="32" stroke={A} strokeWidth="2" />
        <line x1="14" y1="18" x2="14" y2="46" stroke={W} strokeWidth="2" />
        <line x1="20" y1="16" x2="20" y2="26" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="27" x2="20" y2="37" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="38" x2="20" y2="48" stroke={W} strokeWidth="2.5" />
        <line x1="20" y1="21" x2="40" y2="21" stroke={W} strokeWidth="2" />
        <line x1="40" y1="21" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="20" y1="43" x2="40" y2="43" stroke={W} strokeWidth="2" />
        <line x1="40" y1="43" x2="40" y2="62" stroke={A} strokeWidth="2" />
        <polygon points="33,32 26,29 26,35" fill={W} />
      </>
    ),
  },
  potentiometer: {
    label: "Potentiometer", w: 88, h: 40, defaultRef: "RV",
    pins: [{ id: "1", x: 0, y: 28 }, { id: "2", x: 88, y: 28 }, { id: "W", x: 44, y: 0, label: "W" }],
    draw: (style) => (
      <>
        <line x1="0" y1="28" x2="22" y2="28" stroke={A} strokeWidth="2" />
        {style === "iec"
          ? <rect x="22" y="20" width="44" height="16" fill="none" stroke={W} strokeWidth="2" />
          : <polyline points="22,28 28,19 40,37 52,19 64,37 70,28" fill="none" stroke={W} strokeWidth="2" />}
        <line x1={style === "iec" ? 66 : 70} y1="28" x2="88" y2="28" stroke={A} strokeWidth="2" />
        <line x1="44" y1="0" x2="44" y2="16" stroke={A} strokeWidth="2" />
        <polygon points="44,24 39,14 49,14" fill={W} />
      </>
    ),
  },
  switch: {
    label: "Switch", w: 60, h: 24, defaultRef: "SW",
    pins: [{ id: "1", x: 0, y: 16 }, { id: "2", x: 60, y: 16 }],
    draw: () => (
      <>
        <line x1="0" y1="16" x2="16" y2="16" stroke={A} strokeWidth="2" />
        <circle cx="16" cy="16" r="2.5" fill={W} />
        <line x1="16" y1="16" x2="42" y2="4" stroke={W} strokeWidth="2" />
        <circle cx="44" cy="16" r="2.5" fill={W} />
        <line x1="44" y1="16" x2="60" y2="16" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  button: {
    label: "Push Button", w: 60, h: 30, defaultRef: "SW",
    pins: [{ id: "1", x: 0, y: 22 }, { id: "2", x: 60, y: 22 }],
    draw: () => (
      <>
        <line x1="0" y1="22" x2="18" y2="22" stroke={A} strokeWidth="2" />
        <line x1="42" y1="22" x2="60" y2="22" stroke={A} strokeWidth="2" />
        <line x1="18" y1="22" x2="18" y2="14" stroke={W} strokeWidth="2" />
        <line x1="42" y1="22" x2="42" y2="14" stroke={W} strokeWidth="2" />
        <line x1="12" y1="14" x2="48" y2="14" stroke={W} strokeWidth="2" />
        <line x1="30" y1="14" x2="30" y2="6" stroke={W} strokeWidth="2" />
        <line x1="22" y1="6" x2="38" y2="6" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  crystal: {
    label: "Crystal", w: 60, h: 28, defaultRef: "Y",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 60, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="16" y2="14" stroke={A} strokeWidth="2" />
        <line x1="16" y1="5" x2="16" y2="23" stroke={W} strokeWidth="2" />
        <rect x="20" y="3" width="16" height="22" rx="1" fill="none" stroke={W} strokeWidth="2" />
        <line x1="40" y1="5" x2="40" y2="23" stroke={W} strokeWidth="2" />
        <line x1="40" y1="14" x2="60" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  fuse: {
    label: "Fuse", w: 60, h: 20, defaultRef: "F",
    pins: [{ id: "1", x: 0, y: 10 }, { id: "2", x: 60, y: 10 }],
    draw: () => (
      <>
        <line x1="0" y1="10" x2="14" y2="10" stroke={A} strokeWidth="2" />
        <rect x="14" y="3" width="36" height="14" rx="7" fill="none" stroke={W} strokeWidth="2" />
        <line x1="18" y1="10" x2="46" y2="10" stroke={W} strokeWidth="2" />
        <line x1="50" y1="10" x2="60" y2="10" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  testpoint: {
    label: "Test Point", w: 20, h: 22, defaultRef: "TP",
    pins: [{ id: "1", x: 10, y: 22 }],
    draw: () => (
      <>
        <circle cx="10" cy="8" r="6" fill="#3c4658" stroke={W} strokeWidth="2" />
        <line x1="10" y1="14" x2="10" y2="22" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  battery: {
    label: "Battery / Source", w: 40, h: 52, defaultRef: "BT",
    pins: [{ id: "+", x: 20, y: 0, label: "+" }, { id: "-", x: 20, y: 52, label: "−" }],
    draw: () => (
      <>
        <line x1="20" y1="0" x2="20" y2="12" stroke={A} strokeWidth="2" />
        <line x1="6" y1="12" x2="34" y2="12" stroke={W} strokeWidth="2" />
        <line x1="13" y1="19" x2="27" y2="19" stroke={W} strokeWidth="2" />
        <line x1="6" y1="26" x2="34" y2="26" stroke={W} strokeWidth="2" />
        <line x1="13" y1="33" x2="27" y2="33" stroke={W} strokeWidth="2" />
        <line x1="6" y1="40" x2="34" y2="40" stroke={W} strokeWidth="2" />
        <line x1="20" y1="40" x2="20" y2="52" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  "cap-pol": {
    label: "Polarized Cap", w: 60, h: 32, defaultRef: "C",
    pins: [{ id: "1", x: 0, y: 17, label: "+" }, { id: "2", x: 60, y: 17 }],
    draw: () => (
      <>
        <line x1="0" y1="17" x2="28" y2="17" stroke={A} strokeWidth="2" />
        <line x1="28" y1="4" x2="28" y2="30" stroke={W} strokeWidth="2" />
        <path d="M44,4 Q50,17 44,30" fill="none" stroke={W} strokeWidth="2" />
        <line x1="46" y1="17" x2="60" y2="17" stroke={A} strokeWidth="2" />
        <line x1="11" y1="7" x2="19" y2="7" stroke={W} strokeWidth="1.3" />
        <line x1="15" y1="3" x2="15" y2="11" stroke={W} strokeWidth="1.3" />
      </>
    ),
  },
  ferrite: {
    label: "Ferrite Bead", w: 60, h: 20, defaultRef: "FB",
    pins: [{ id: "1", x: 0, y: 10 }, { id: "2", x: 60, y: 10 }],
    draw: () => (
      <>
        <line x1="0" y1="10" x2="14" y2="10" stroke={A} strokeWidth="2" />
        <rect x="14" y="3" width="36" height="14" rx="7" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="50" y1="10" x2="60" y2="10" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  schottky: {
    label: "Schottky", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="28" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="28,5 28,23 44,14" fill={W} />
        <line x1="44" y1="5" x2="44" y2="23" stroke={W} strokeWidth="2" />
        <polyline points="38,9 38,5 44,5" fill="none" stroke={W} strokeWidth="2" />
        <polyline points="44,23 50,23 50,19" fill="none" stroke={W} strokeWidth="2" />
        <line x1="44" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  photodiode: {
    label: "Photodiode", w: 70, h: 40, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 22 }, { id: "2", x: 70, y: 22 }],
    draw: () => (
      <>
        <line x1="0" y1="22" x2="28" y2="22" stroke={A} strokeWidth="2" />
        <polygon points="28,13 28,31 44,22" fill={W} />
        <line x1="44" y1="13" x2="44" y2="31" stroke={W} strokeWidth="2" />
        <line x1="44" y1="22" x2="70" y2="22" stroke={A} strokeWidth="2" />
        <line x1="50" y1="2" x2="40" y2="12" stroke={W} strokeWidth="1.5" />
        <polyline points="40,8 40,12 44,12" fill="none" stroke={W} strokeWidth="1.5" />
        <line x1="57" y1="5" x2="47" y2="15" stroke={W} strokeWidth="1.5" />
        <polyline points="47,11 47,15 51,15" fill="none" stroke={W} strokeWidth="1.5" />
      </>
    ),
  },
  opamp: {
    label: "Op-Amp", w: 64, h: 56, defaultRef: "U",
    pins: [{ id: "in+", x: 0, y: 16, label: "+" }, { id: "in-", x: 0, y: 40, label: "−" }, { id: "out", x: 64, y: 28 }],
    draw: () => (
      <>
        <polygon points="12,4 12,52 58,28" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="0" y1="16" x2="12" y2="16" stroke={A} strokeWidth="2" />
        <line x1="0" y1="40" x2="12" y2="40" stroke={A} strokeWidth="2" />
        <line x1="58" y1="28" x2="64" y2="28" stroke={A} strokeWidth="2" />
        <line x1="16" y1="16" x2="22" y2="16" stroke={W} strokeWidth="1.3" />
        <line x1="19" y1="13" x2="19" y2="19" stroke={W} strokeWidth="1.3" />
        <line x1="16" y1="40" x2="22" y2="40" stroke={W} strokeWidth="1.3" />
      </>
    ),
  },
  regulator: {
    label: "Regulator", w: 72, h: 58, defaultRef: "U",
    pins: [{ id: "IN", x: 0, y: 25, label: "IN" }, { id: "OUT", x: 72, y: 25, label: "OUT" }, { id: "GND", x: 36, y: 58, label: "GND" }],
    draw: () => (
      <>
        <rect x="16" y="8" width="40" height="34" rx="3" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="0" y1="25" x2="16" y2="25" stroke={A} strokeWidth="2" />
        <line x1="56" y1="25" x2="72" y2="25" stroke={A} strokeWidth="2" />
        <line x1="36" y1="42" x2="36" y2="58" stroke={A} strokeWidth="2" />
        <text x="36" y="29" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={W}>REG</text>
      </>
    ),
  },
  transformer: {
    label: "Transformer", w: 72, h: 72, defaultRef: "T",
    pins: [{ id: "P1", x: 0, y: 14 }, { id: "P2", x: 0, y: 58 }, { id: "S1", x: 72, y: 14 }, { id: "S2", x: 72, y: 58 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="26" y2="14" stroke={A} strokeWidth="2" />
        <line x1="0" y1="58" x2="26" y2="58" stroke={A} strokeWidth="2" />
        <path d="M26,14 q14,7 0,14 q14,7 0,14 q14,7 0,14" fill="none" stroke={W} strokeWidth="2" />
        <line x1="34" y1="10" x2="34" y2="62" stroke={W} strokeWidth="1.5" />
        <line x1="38" y1="10" x2="38" y2="62" stroke={W} strokeWidth="1.5" />
        <path d="M46,14 q-14,7 0,14 q-14,7 0,14 q-14,7 0,14" fill="none" stroke={W} strokeWidth="2" />
        <line x1="46" y1="14" x2="72" y2="14" stroke={A} strokeWidth="2" />
        <line x1="46" y1="58" x2="72" y2="58" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  relay: {
    label: "Relay", w: 76, h: 64, defaultRef: "K",
    pins: [
      { id: "A", x: 0, y: 20, label: "A" }, { id: "B", x: 0, y: 44, label: "B" },
      { id: "COM", x: 76, y: 32, label: "C" }, { id: "NO", x: 76, y: 10, label: "NO" }, { id: "NC", x: 76, y: 54, label: "NC" },
    ],
    draw: () => (
      <>
        <line x1="0" y1="20" x2="10" y2="20" stroke={A} strokeWidth="2" />
        <line x1="0" y1="44" x2="10" y2="44" stroke={A} strokeWidth="2" />
        <rect x="10" y="14" width="18" height="36" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="36" y1="32" x2="52" y2="32" stroke={W} strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="54" cy="32" r="2.5" fill={W} />
        <line x1="54" y1="32" x2="68" y2="14" stroke={W} strokeWidth="2" />
        <line x1="54" y1="32" x2="76" y2="32" stroke={A} strokeWidth="2" />
        <circle cx="68" cy="12" r="2.5" fill={W} />
        <line x1="68" y1="12" x2="76" y2="10" stroke={A} strokeWidth="2" />
        <circle cx="68" cy="52" r="2.5" fill={W} />
        <line x1="68" y1="52" x2="76" y2="54" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  spst: {
    label: "Relay SPST", w: 64, h: 56, defaultRef: "K",
    pins: [
      { id: "A", x: 0, y: 18, label: "A" }, { id: "B", x: 0, y: 38, label: "B" },
      { id: "1", x: 64, y: 18, label: "1" }, { id: "2", x: 64, y: 38, label: "2" },
    ],
    draw: () => (
      <>
        <line x1="0" y1="18" x2="10" y2="18" stroke={A} strokeWidth="2" />
        <line x1="0" y1="38" x2="10" y2="38" stroke={A} strokeWidth="2" />
        <rect x="10" y="12" width="16" height="32" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="32" y1="28" x2="44" y2="28" stroke={W} strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="46" cy="18" r="2.5" fill={W} />
        <line x1="46" y1="18" x2="60" y2="34" stroke={W} strokeWidth="2" />
        <circle cx="60" cy="38" r="2.5" fill={W} />
        <line x1="46" y1="18" x2="64" y2="18" stroke={A} strokeWidth="2" />
        <line x1="60" y1="38" x2="64" y2="38" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  dpdt: {
    label: "Relay DPDT", w: 80, h: 92, defaultRef: "K",
    pins: [
      { id: "A", x: 0, y: 30, label: "A" }, { id: "B", x: 0, y: 62, label: "B" },
      { id: "COM1", x: 80, y: 14, label: "C1" }, { id: "NO1", x: 80, y: 2, label: "NO1" }, { id: "NC1", x: 80, y: 26, label: "NC1" },
      { id: "COM2", x: 80, y: 62, label: "C2" }, { id: "NO2", x: 80, y: 50, label: "NO2" }, { id: "NC2", x: 80, y: 74, label: "NC2" },
    ],
    draw: () => (
      <>
        <line x1="0" y1="30" x2="12" y2="30" stroke={A} strokeWidth="2" />
        <line x1="0" y1="62" x2="12" y2="62" stroke={A} strokeWidth="2" />
        <rect x="12" y="22" width="16" height="48" fill="#566177" stroke={W} strokeWidth="2" />
        {[14, 62].map((cy, k) => (
          <g key={k}>
            <line x1="34" y1={cy} x2="50" y2={cy} stroke={W} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="52" cy={cy} r="2.5" fill={W} />
            <line x1="52" y1={cy} x2="66" y2={cy - 12} stroke={W} strokeWidth="2" />
            <line x1="52" y1={cy} x2="80" y2={cy} stroke={A} strokeWidth="2" />
            <line x1="66" y1={cy - 12} x2="80" y2={cy - 12} stroke={A} strokeWidth="2" />
            <line x1="66" y1={cy + 12} x2="80" y2={cy + 12} stroke={A} strokeWidth="2" />
          </g>
        ))}
      </>
    ),
  },
  ssr: {
    label: "Solid-State Relay", w: 72, h: 56, defaultRef: "K",
    pins: [
      { id: "+", x: 0, y: 16, label: "+" }, { id: "-", x: 0, y: 40, label: "−" },
      { id: "1", x: 72, y: 16, label: "1" }, { id: "2", x: 72, y: 40, label: "2" },
    ],
    draw: () => (
      <>
        <rect x="14" y="6" width="44" height="44" fill="none" stroke={W} strokeWidth="2" rx="3" />
        <line x1="0" y1="16" x2="14" y2="16" stroke={A} strokeWidth="2" />
        <line x1="0" y1="40" x2="14" y2="40" stroke={A} strokeWidth="2" />
        <line x1="58" y1="16" x2="72" y2="16" stroke={A} strokeWidth="2" />
        <line x1="58" y1="40" x2="72" y2="40" stroke={A} strokeWidth="2" />
        {/* opto LED (control) → arrows → output switch */}
        <line x1="22" y1="16" x2="22" y2="40" stroke={W} strokeWidth="2" />
        <path d="M22 22 L28 28 L22 34 Z" fill={W} />
        <line x1="28" y1="22" x2="28" y2="34" stroke={W} strokeWidth="2" />
        <line x1="33" y1="20" x2="38" y2="15" stroke={W} strokeWidth="1.2" /><path d="M38 15 l-3 0 l1.5 2.5 z" fill={W} />
        <line x1="36" y1="24" x2="41" y2="19" stroke={W} strokeWidth="1.2" /><path d="M41 19 l-3 0 l1.5 2.5 z" fill={W} />
        <line x1="46" y1="16" x2="46" y2="40" stroke={W} strokeWidth="2" />
        <line x1="50" y1="16" x2="50" y2="40" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  motor: {
    label: "Motor", w: 44, h: 44, defaultRef: "M",
    pins: [{ id: "1", x: 0, y: 22 }, { id: "2", x: 44, y: 22 }],
    draw: () => (
      <>
        <line x1="0" y1="22" x2="8" y2="22" stroke={A} strokeWidth="2" />
        <line x1="36" y1="22" x2="44" y2="22" stroke={A} strokeWidth="2" />
        <circle cx="22" cy="22" r="14" fill="none" stroke={W} strokeWidth="2" />
        <text x="22" y="27" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill={W}>M</text>
      </>
    ),
  },
  lamp: {
    label: "Lamp", w: 40, h: 40, defaultRef: "LP",
    pins: [{ id: "1", x: 0, y: 20 }, { id: "2", x: 40, y: 20 }],
    draw: () => (
      <>
        <line x1="0" y1="20" x2="8" y2="20" stroke={A} strokeWidth="2" />
        <line x1="32" y1="20" x2="40" y2="20" stroke={A} strokeWidth="2" />
        <circle cx="20" cy="20" r="12" fill="none" stroke={W} strokeWidth="2" />
        <line x1="11" y1="11" x2="29" y2="29" stroke={W} strokeWidth="1.5" />
        <line x1="29" y1="11" x2="11" y2="29" stroke={W} strokeWidth="1.5" />
      </>
    ),
  },
  speaker: {
    label: "Speaker", w: 44, h: 40, defaultRef: "LS",
    pins: [{ id: "1", x: 0, y: 12 }, { id: "2", x: 0, y: 28 }],
    draw: () => (
      <>
        <line x1="0" y1="12" x2="12" y2="12" stroke={A} strokeWidth="2" />
        <line x1="0" y1="28" x2="12" y2="28" stroke={A} strokeWidth="2" />
        <rect x="12" y="10" width="10" height="20" fill="#566177" stroke={W} strokeWidth="2" />
        <polygon points="22,10 22,30 40,38 40,2" fill="none" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  buzzer: {
    label: "Buzzer", w: 44, h: 44, defaultRef: "BZ",
    pins: [{ id: "1", x: 0, y: 22 }, { id: "2", x: 44, y: 22 }],
    draw: () => (
      <>
        <line x1="0" y1="22" x2="10" y2="22" stroke={A} strokeWidth="2" />
        <line x1="34" y1="22" x2="44" y2="22" stroke={A} strokeWidth="2" />
        <path d="M10,22 A 12 12 0 0 1 34,22 Z" fill="#566177" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  isource: {
    label: "Current Source", w: 40, h: 52, defaultRef: "I",
    pins: [{ id: "1", x: 20, y: 0 }, { id: "2", x: 20, y: 52 }],
    draw: () => (
      <>
        <line x1="20" y1="0" x2="20" y2="10" stroke={A} strokeWidth="2" />
        <circle cx="20" cy="26" r="16" fill="none" stroke={W} strokeWidth="2" />
        <line x1="20" y1="35" x2="20" y2="19" stroke={W} strokeWidth="2" />
        <polygon points="20,15 16,22 24,22" fill={W} />
        <line x1="20" y1="42" x2="20" y2="52" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  acsource: {
    label: "AC Source", w: 40, h: 52, defaultRef: "V",
    pins: [{ id: "1", x: 20, y: 0 }, { id: "2", x: 20, y: 52 }],
    draw: () => (
      <>
        <line x1="20" y1="0" x2="20" y2="10" stroke={A} strokeWidth="2" />
        <circle cx="20" cy="26" r="16" fill="none" stroke={W} strokeWidth="2" />
        <path d="M10,26 q5,-10 10,0 q5,10 10,0" fill="none" stroke={W} strokeWidth="2" />
        <line x1="20" y1="42" x2="20" y2="52" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  vcc: {
    label: "Power (V+)", w: 24, h: 24, defaultRef: "VCC",
    pins: [{ id: "1", x: 12, y: 24 }],
    draw: () => (
      <>
        <line x1="12" y1="24" x2="12" y2="8" stroke={A} strokeWidth="2" />
        <line x1="2" y1="8" x2="22" y2="8" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  antenna: {
    label: "Antenna", w: 32, h: 36, defaultRef: "ANT",
    pins: [{ id: "1", x: 16, y: 36 }],
    draw: () => (
      <>
        <line x1="16" y1="36" x2="16" y2="18" stroke={A} strokeWidth="2" />
        <line x1="16" y1="18" x2="4" y2="2" stroke={W} strokeWidth="2" />
        <line x1="16" y1="18" x2="28" y2="2" stroke={W} strokeWidth="2" />
      </>
    ),
  },
  header2: {
    label: "Header 2", w: 26, h: 44, defaultRef: "J",
    pins: [{ id: "1", x: 0, y: 12, label: "1" }, { id: "2", x: 0, y: 32, label: "2" }],
    draw: () => (
      <>
        <rect x="10" y="4" width="14" height="36" rx="2" fill="#566177" stroke={W} strokeWidth="2" />
        <line x1="0" y1="12" x2="10" y2="12" stroke={A} strokeWidth="2" />
        <circle cx="10" cy="12" r="2.5" fill={W} />
        <line x1="0" y1="32" x2="10" y2="32" stroke={A} strokeWidth="2" />
        <circle cx="10" cy="32" r="2.5" fill={W} />
      </>
    ),
  },
  header4: {
    label: "Header 4", w: 26, h: 84, defaultRef: "J",
    pins: [
      { id: "1", x: 0, y: 12, label: "1" }, { id: "2", x: 0, y: 32, label: "2" },
      { id: "3", x: 0, y: 52, label: "3" }, { id: "4", x: 0, y: 72, label: "4" },
    ],
    draw: () => (
      <>
        <rect x="10" y="4" width="14" height="76" rx="2" fill="#566177" stroke={W} strokeWidth="2" />
        {[12, 32, 52, 72].map((y) => (
          <g key={y}>
            <line x1="0" y1={y} x2="10" y2={y} stroke={A} strokeWidth="2" />
            <circle cx="10" cy={y} r="2.5" fill={W} />
          </g>
        ))}
      </>
    ),
  },
  // parametric chip: instances carry a `chip` spec (profile + pins); this static def is just
  // the palette icon + default ref. Geometry/pins come from chipGeometry via symDims.
  chip: {
    label: "Chip / IC", w: 68, h: 88, defaultRef: "U",
    pins: [
      { id: "1", x: 0, y: 14 }, { id: "2", x: 0, y: 34 }, { id: "3", x: 0, y: 54 }, { id: "4", x: 0, y: 74 },
      { id: "5", x: 68, y: 74 }, { id: "6", x: 68, y: 54 }, { id: "7", x: 68, y: 34 }, { id: "8", x: 68, y: 14 },
    ],
    draw: () => (
      <>
        {[14, 34, 54, 74].map((y) => (
          <g key={y}>
            <line x1="0" y1={y} x2="12" y2={y} stroke={A} strokeWidth="2" />
            <line x1="56" y1={y} x2="68" y2={y} stroke={A} strokeWidth="2" />
          </g>
        ))}
        <rect x="12" y="6" width="44" height="76" rx="3" fill="#566177" stroke={W} strokeWidth="2" />
        <circle cx="19" cy="13" r="2.5" fill={W} />
      </>
    ),
  },
  njfet: {
    label: "N-JFET", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "G", x: 0, y: 32, label: "G" }, { id: "D", x: 40, y: 2, label: "D" }, { id: "S", x: 40, y: 62, label: "S" }],
    draw: () => (
      <>
        <circle cx="28" cy="32" r="24" fill="none" stroke={W} strokeWidth="1.2" />
        <line x1="0" y1="32" x2="22" y2="32" stroke={A} strokeWidth="2" />
        <polygon points="22,28 28,32 22,36" fill={W} />
        <line x1="28" y1="14" x2="28" y2="50" stroke={W} strokeWidth="2.5" />
        <line x1="28" y1="20" x2="40" y2="20" stroke={W} strokeWidth="2" />
        <line x1="40" y1="20" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="28" y1="44" x2="40" y2="44" stroke={W} strokeWidth="2" />
        <line x1="40" y1="44" x2="40" y2="62" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  pjfet: {
    label: "P-JFET", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "G", x: 0, y: 32, label: "G" }, { id: "D", x: 40, y: 2, label: "D" }, { id: "S", x: 40, y: 62, label: "S" }],
    draw: () => (
      <>
        <circle cx="28" cy="32" r="24" fill="none" stroke={W} strokeWidth="1.2" />
        <line x1="0" y1="32" x2="22" y2="32" stroke={A} strokeWidth="2" />
        <polygon points="28,28 22,32 28,36" fill={W} />
        <line x1="28" y1="14" x2="28" y2="50" stroke={W} strokeWidth="2.5" />
        <line x1="28" y1="20" x2="40" y2="20" stroke={W} strokeWidth="2" />
        <line x1="40" y1="20" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="28" y1="44" x2="40" y2="44" stroke={W} strokeWidth="2" />
        <line x1="40" y1="44" x2="40" y2="62" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  phototransistor: {
    label: "Phototransistor", w: 58, h: 64, defaultRef: "Q",
    pins: [{ id: "C", x: 40, y: 2, label: "C" }, { id: "E", x: 40, y: 62, label: "E" }],
    draw: () => (
      <>
        <circle cx="28" cy="32" r="24" fill="none" stroke={W} strokeWidth="1.2" />
        <line x1="18" y1="18" x2="18" y2="46" stroke={W} strokeWidth="2" />
        <line x1="18" y1="27" x2="40" y2="14" stroke={W} strokeWidth="2" />
        <line x1="40" y1="14" x2="40" y2="2" stroke={A} strokeWidth="2" />
        <line x1="18" y1="37" x2="40" y2="50" stroke={W} strokeWidth="2" />
        <line x1="40" y1="50" x2="40" y2="62" stroke={A} strokeWidth="2" />
        <polygon points="35,52 29,46 37,44" fill={W} />
        <line x1="2" y1="20" x2="12" y2="28" stroke={W} strokeWidth="1.3" />
        <polyline points="12,22 12,28 6,28" fill="none" stroke={W} strokeWidth="1.3" />
        <line x1="6" y1="30" x2="16" y2="38" stroke={W} strokeWidth="1.3" />
        <polyline points="16,32 16,38 10,38" fill="none" stroke={W} strokeWidth="1.3" />
      </>
    ),
  },
  scr: {
    label: "SCR / Thyristor", w: 70, h: 48, defaultRef: "D",
    pins: [{ id: "A", x: 0, y: 14, label: "A" }, { id: "K", x: 70, y: 14, label: "K" }, { id: "G", x: 40, y: 44, label: "G" }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="28" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="28,5 28,23 44,14" fill={W} />
        <line x1="44" y1="5" x2="44" y2="23" stroke={W} strokeWidth="2" />
        <line x1="44" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
        <line x1="44" y1="18" x2="40" y2="32" stroke={W} strokeWidth="2" />
        <line x1="40" y1="32" x2="40" y2="44" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  triac: {
    label: "Triac", w: 70, h: 48, defaultRef: "D",
    pins: [{ id: "MT1", x: 0, y: 14, label: "T1" }, { id: "MT2", x: 70, y: 14, label: "T2" }, { id: "G", x: 40, y: 44, label: "G" }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="18" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="18,5 18,23 34,14" fill={W} />
        <polygon points="52,5 52,23 36,14" fill={W} />
        <line x1="34" y1="4" x2="34" y2="24" stroke={W} strokeWidth="2" />
        <line x1="36" y1="4" x2="36" y2="24" stroke={W} strokeWidth="2" />
        <line x1="52" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
        <line x1="34" y1="20" x2="40" y2="32" stroke={W} strokeWidth="2" />
        <line x1="40" y1="32" x2="40" y2="44" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  diac: {
    label: "Diac", w: 70, h: 28, defaultRef: "D",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 70, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="18" y2="14" stroke={A} strokeWidth="2" />
        <polygon points="18,5 18,23 34,14" fill={W} />
        <polygon points="52,5 52,23 36,14" fill={W} />
        <line x1="34" y1="4" x2="34" y2="24" stroke={W} strokeWidth="2" />
        <line x1="36" y1="4" x2="36" y2="24" stroke={W} strokeWidth="2" />
        <line x1="52" y1="14" x2="70" y2="14" stroke={A} strokeWidth="2" />
      </>
    ),
  },
  thermistor: {
    label: "Thermistor (NTC)", w: 90, h: 28, defaultRef: "TH",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 90, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="22" y2="14" stroke={A} strokeWidth="2" />
        <rect x="22" y="6" width="46" height="16" fill="none" stroke={W} strokeWidth="2" />
        <line x1="68" y1="14" x2="90" y2="14" stroke={A} strokeWidth="2" />
        <line x1="24" y1="26" x2="58" y2="2" stroke={W} strokeWidth="1.6" />
        <line x1="24" y1="26" x2="32" y2="26" stroke={W} strokeWidth="1.6" />
      </>
    ),
  },
  ldr: {
    label: "Photoresistor (LDR)", w: 90, h: 42, defaultRef: "R",
    pins: [{ id: "1", x: 0, y: 24 }, { id: "2", x: 90, y: 24 }],
    draw: () => (
      <>
        <line x1="0" y1="24" x2="26" y2="24" stroke={A} strokeWidth="2" />
        <rect x="26" y="16" width="38" height="16" fill="none" stroke={W} strokeWidth="2" />
        <line x1="64" y1="24" x2="90" y2="24" stroke={A} strokeWidth="2" />
        <line x1="38" y1="2" x2="44" y2="12" stroke={W} strokeWidth="1.4" />
        <polyline points="38,8 44,12 44,6" fill="none" stroke={W} strokeWidth="1.4" />
        <line x1="50" y1="2" x2="56" y2="12" stroke={W} strokeWidth="1.4" />
        <polyline points="50,8 56,12 56,6" fill="none" stroke={W} strokeWidth="1.4" />
      </>
    ),
  },
  varistor: {
    label: "Varistor (MOV)", w: 90, h: 28, defaultRef: "RV",
    pins: [{ id: "1", x: 0, y: 14 }, { id: "2", x: 90, y: 14 }],
    draw: () => (
      <>
        <line x1="0" y1="14" x2="22" y2="14" stroke={A} strokeWidth="2" />
        <rect x="22" y="6" width="46" height="16" fill="none" stroke={W} strokeWidth="2" />
        <line x1="68" y1="14" x2="90" y2="14" stroke={A} strokeWidth="2" />
        <line x1="28" y1="26" x2="62" y2="2" stroke={W} strokeWidth="1.6" />
        <text x="58" y="6" fontFamily="var(--font-mono)" fontSize="8" fill={W}>U</text>
      </>
    ),
  },
  // Off-board net reference: a connection that leaves the board (a connector, cable, another board,
  // an external supply). Wiring a net to one declares it externally driven/terminated — so ERC stops
  // flagging it as floating, and the marker's ref (e.g. CAN_PWR, +12V_EXT) names the net.
  offboard: {
    label: "Off-board net", w: 44, h: 20, defaultRef: "EXT",
    pins: [{ id: "1", x: 0, y: 10 }],
    draw: () => (
      <>
        <line x1="0" y1="10" x2="10" y2="10" stroke={A} strokeWidth="2" />
        <polygon points="10,2 30,2 42,10 30,18 10,18" fill="#3c4658" stroke={A} strokeWidth="2" />
        <line x1="15" y1="7" x2="26" y2="7" stroke={A} strokeWidth="1.4" />
        <line x1="15" y1="13" x2="23" y2="13" stroke={A} strokeWidth="1.4" />
      </>
    ),
  },
  // a block terminal exposed to the outside world; placed/managed by the editor, not the palette
  port: {
    label: "Port", w: 30, h: 20, defaultRef: "P",
    pins: [{ id: "1", x: 0, y: 10 }],
    draw: () => (
      <>
        <line x1="0" y1="10" x2="14" y2="10" stroke={A} strokeWidth="2" />
        <circle cx="20" cy="10" r="7" fill="#3c4658" stroke={A} strokeWidth="2" />
      </>
    ),
  },
};

export interface SymbolData {
  symType: string;
  ref?: string;
  value?: string;
  [k: string]: unknown;
}

export function SymbolNode(props: NodeProps) {
  const d = props.data as unknown as SymbolData;
  const sym = SYMBOLS[d.symType];
  if (!sym) return null;
  const sel = props.selected;
  return (
    <div style={{ width: sym.w, height: sym.h, position: "relative" }}>
      <svg width={sym.w} height={sym.h} viewBox={`0 0 ${sym.w} ${sym.h}`} style={{ overflow: "visible", color: "var(--color-text)" }}>
        {sym.draw()}
      </svg>
      {(d.ref || d.value) && (
        <div style={{ position: "absolute", top: -16, left: 0, width: sym.w }}
          className="text-center font-mono text-[10px] text-[var(--color-text)] pointer-events-none">
          {d.ref}{d.value ? ` ${d.value}` : ""}
        </div>
      )}
      {sel && <div style={{ position: "absolute", inset: -6, border: `1px solid ${A}`, borderRadius: 6 }} />}
      {sym.pins.map((p) => (
        <Handle key={p.id} id={p.id} type="source" position={Position.Left}
          style={{ left: p.x, top: p.y, transform: "translate(-50%,-50%)", width: 8, height: 8, background: A, border: "none" }} />
      ))}
    </div>
  );
}

export const symbolNodeTypes = { symbol: SymbolNode };

/** Draw a parametric chip's glyph (body + pin stubs/balls + pin-1 marker + part number). */
export function renderChip(dims: Dims, chip: ChipSpec): React.ReactNode {
  const b = dims.body ?? { x: 0, y: 0, w: dims.w, h: dims.h };
  return (
    <>
      {dims.pins.map((p) => {
        const inside = p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
        if (inside) return <circle key={p.id} cx={p.x} cy={p.y} r="3" fill="none" stroke={A} strokeWidth="1.5" />;
        const ex = Math.max(b.x, Math.min(b.x + b.w, p.x));
        const ey = Math.max(b.y, Math.min(b.y + b.h, p.y));
        return <line key={p.id} x1={p.x} y1={p.y} x2={ex} y2={ey} stroke={A} strokeWidth="2" />;
      })}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="3" fill="#566177" stroke={W} strokeWidth="2" />
      {dims.pin1 && <circle cx={dims.pin1.x} cy={dims.pin1.y} r="2.5" fill={W} />}
      {chip.mpn && <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 3} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill={W}>{chip.mpn}</text>}
    </>
  );
}

// ── Symbol standard (ANSI/IEC), persisted in localStorage ───────────────────
const STYLE_KEY = "electrace:symstyle";

export function getSymbolStyle(): SymStyle {
  try { return (localStorage.getItem(STYLE_KEY) as SymStyle) || "ansi"; } catch { return "ansi"; }
}
export function setSymbolStyle(s: SymStyle): void {
  try { localStorage.setItem(STYLE_KEY, s); window.dispatchEvent(new CustomEvent("electrace:symstyle")); } catch { /* ignore */ }
}
/** Subscribe to the current symbol standard. SSR-safe: starts "ansi", syncs after mount. */
export function useSymbolStyle(): SymStyle {
  const [s, setS] = useState<SymStyle>("ansi");
  useEffect(() => {
    const sync = () => setS(getSymbolStyle());
    sync();
    window.addEventListener("electrace:symstyle", sync);
    return () => window.removeEventListener("electrace:symstyle", sync);
  }, []);
  return s;
}

/** Palette grouping + display order. `port` is intentionally omitted (editor-managed). */
export const SYMBOL_GROUPS: { name: string; types: string[] }[] = [
  { name: "Passive", types: ["resistor", "potentiometer", "capacitor", "cap-pol", "inductor", "transformer", "ferrite", "crystal", "fuse", "thermistor", "ldr", "varistor"] },
  { name: "Diode", types: ["diode", "schottky", "zener", "tvs", "tvs_bi", "led", "photodiode", "scr", "triac", "diac"] },
  { name: "Transistor", types: ["npn", "pnp", "nmos", "pmos", "njfet", "pjfet", "phototransistor"] },
  { name: "Integrated", types: ["chip", "ic", "opamp", "regulator"] },
  { name: "Source", types: ["battery", "isource", "acsource"] },
  { name: "Power", types: ["ground", "vcc", "offboard"] },
  { name: "Electromechanical", types: ["switch", "button", "relay", "spst", "dpdt", "ssr", "motor", "speaker", "buzzer", "lamp"] },
  { name: "Connector", types: ["header2", "header4", "testpoint", "antenna"] },
];
