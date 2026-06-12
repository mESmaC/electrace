// Dashboard "Start something new" templates. Each seeds a REAL design from library blocks —
// a template card that promises "Entry → regulate → rails" and delivers an empty canvas is a lie.
// Wiring here must stay electrically valid against the blocks' declared specs: a fresh template
// must open with ZERO errors/warnings (validated in web/test; recommendations are fine). It's the
// user's first impression of the checks — a template that opens amber looks broken, not helpful.
import type { Design } from "@electrace/core";

type Base = Omit<Design, "id" | "name">; // createProject() stamps id + name

// Entry → regulate → rails: 12 V in, buck to 5 V, LDO to 3.3 V, an indicator on each rail.
const powerSupply: Base = {
  blocks: [
    { ref: "PWR1", block: "@electrace/power-entry@1.0.0", pos: [40, 140] },
    { ref: "REG1", block: "@electrace/buck-converter@1.2.0", pos: [320, 148] },
    { ref: "REG2", block: "@electrace/ldo-regulator@1.0.0", pos: [640, 80] },
    { ref: "LED1", block: "@electrace/led-indicator@1.0.0", pos: [640, 280] },
    { ref: "LED2", block: "@electrace/led-indicator@1.0.0", pos: [920, 100] },
  ],
  connections: [
    { from: "PWR1.vout", to: "REG1.vin", net: "VIN" },
    { from: "PWR1.gnd", to: "REG1.gnd_in", net: "GND" },
    { from: "REG1.vout", to: "REG2.vin", net: "+5V" },
    { from: "REG1.gnd_out", to: "REG2.gnd", net: "GND" },
    { from: "REG1.vout", to: "LED1.vin", net: "+5V" },
    { from: "REG1.gnd_out", to: "LED1.gnd", net: "GND" },
    { from: "REG2.vout", to: "LED2.vin", net: "+3V3" },
    { from: "REG2.gnd", to: "LED2.gnd", net: "GND" },
  ],
};

// The conversion itself, minimal: wall input stepped down to a loaded 5 V rail.
const buckConverter: Base = {
  blocks: [
    { ref: "PWR1", block: "@electrace/power-entry@1.0.0", pos: [40, 120] },
    { ref: "REG1", block: "@electrace/buck-converter@1.2.0", pos: [320, 128] },
    { ref: "LED1", block: "@electrace/led-indicator@1.0.0", pos: [640, 150] },
  ],
  connections: [
    { from: "PWR1.vout", to: "REG1.vin", net: "VIN" },
    { from: "PWR1.gnd", to: "REG1.gnd_in", net: "GND" },
    { from: "REG1.vout", to: "LED1.vin", net: "+5V" },
    { from: "REG1.gnd_out", to: "LED1.gnd", net: "GND" },
  ],
};

// Micro + power + IO: regulated rail into the MCU, its status pin driving an LED.
const mcuBoard: Base = {
  blocks: [
    { ref: "PWR1", block: "@electrace/power-entry@1.0.0", pos: [40, 120] },
    { ref: "REG1", block: "@electrace/buck-converter@1.2.0", pos: [320, 128] },
    { ref: "MCU1", block: "@electrace/mcu-load@1.0.0", pos: [640, 140] },
    { ref: "LED1", block: "@electrace/led-indicator@1.0.0", pos: [920, 150] },
  ],
  connections: [
    { from: "PWR1.vout", to: "REG1.vin", net: "VIN" },
    { from: "PWR1.gnd", to: "REG1.gnd_in", net: "GND" },
    { from: "REG1.vout", to: "MCU1.vdd", net: "+5V" },
    { from: "REG1.gnd_out", to: "MCU1.gnd", net: "GND" },
    { from: "MCU1.status", to: "LED1.vin", net: "STATUS" },
    { from: "REG1.gnd_out", to: "LED1.gnd", net: "GND" },
  ],
};

// Sense → amplify → filter → decide: NTC divider into the op-amp, RC cleanup,
// comparator threshold, alert LED. The full analog front-end story on one canvas.
const sensorFrontEnd: Base = {
  blocks: [
    { ref: "PWR1", block: "@electrace/power-entry@1.0.0", pos: [40, 60] },
    { ref: "REG1", block: "@electrace/buck-converter@1.2.0", pos: [320, 68] },
    { ref: "TH1", block: "@electrace/ntc-thermistor@1.0.0", pos: [60, 380] },
    { ref: "AMP1", block: "@electrace/opamp-noninverting@1.0.0", pos: [320, 400] },
    { ref: "FILT1", block: "@electrace/rc-lowpass@1.0.0", pos: [640, 420] },
    { ref: "CMP1", block: "@electrace/comparator-hysteresis@1.0.0", pos: [900, 400] },
    { ref: "LED1", block: "@electrace/led-indicator@1.0.0", pos: [1160, 420] },
  ],
  connections: [
    { from: "PWR1.vout", to: "REG1.vin", net: "VIN" },
    { from: "PWR1.gnd", to: "REG1.gnd_in", net: "GND" },
    { from: "REG1.vout", to: "TH1.vcc", net: "+5V" },
    { from: "REG1.vout", to: "AMP1.vcc", net: "+5V" },
    { from: "REG1.vout", to: "CMP1.vcc", net: "+5V" },
    { from: "REG1.gnd_out", to: "TH1.gnd", net: "GND" },
    { from: "REG1.gnd_out", to: "AMP1.gnd", net: "GND" },
    { from: "REG1.gnd_out", to: "FILT1.gnd", net: "GND" },
    { from: "REG1.gnd_out", to: "CMP1.gnd", net: "GND" },
    { from: "REG1.gnd_out", to: "LED1.gnd", net: "GND" },
    { from: "TH1.out", to: "AMP1.in", net: "SENSE" },
    { from: "AMP1.out", to: "FILT1.in", net: "AMP_OUT" },
    { from: "FILT1.out", to: "CMP1.in", net: "FILTERED" },
    { from: "CMP1.out", to: "LED1.vin", net: "ALERT" },
  ],
};

export interface Template {
  name: string;
  desc: string;
  glyph: string;
  cls: string;
  base?: Base; // undefined = truly blank canvas
}

export const TEMPLATES: Template[] = [
  { name: "Power supply", desc: "Entry → regulate → rails", glyph: "⎓", cls: "text-amber bg-amber/15 border-amber/40", base: powerSupply },
  { name: "Buck converter", desc: "Step a voltage down", glyph: "⇄", cls: "text-[#3fd0e6] bg-[#3fd0e6]/15 border-[#3fd0e6]/40", base: buckConverter },
  { name: "MCU board", desc: "Micro + power + IO", glyph: "⊞", cls: "text-[#c08cf7] bg-[#c08cf7]/15 border-[#c08cf7]/40", base: mcuBoard },
  { name: "Sensor front-end", desc: "Sense → amplify → filter → decide", glyph: "⊳", cls: "text-green bg-green/15 border-green/40", base: sensorFrontEnd },
  { name: "Blank canvas", desc: "Start from nothing", glyph: "＋", cls: "text-dim bg-surface-2 border-border" },
];
