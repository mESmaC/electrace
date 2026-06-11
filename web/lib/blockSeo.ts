// Public-page SEO titles, aligned with how people ACTUALLY search (SEMrush keyword data),
// without touching block.name (which is the editor-palette label). Used by the block page's
// <title>, H1, and JSON-LD headline. Only override where search phrasing clearly differs
// from the block name — natural language, never stuffing; absent = block.name as before.
export const BLOCK_SEO: Record<string, string> = {
  "h-bridge": "H-bridge motor driver",                       // ranks for "h bridge driver"
  "mosfet-switch": "MOSFET switch (FET switch)",             // ranks for "fet switch"
  "timer-555": "555 timer circuit",
  "buck-converter": "Buck converter circuit",
  "boost-converter": "Boost converter circuit",
  "ldo-regulator": "LDO voltage regulator",
  "liion-charger": "Li-ion battery charger (TP4056)",
  "bridge-rectifier": "Bridge rectifier circuit",
  "crystal-oscillator": "Crystal oscillator circuit",
  "relay-driver": "Relay driver circuit",
  "debounced-button": "Button debounce circuit",
  "i2c-level-shifter": "I2C level shifter",
  "comparator-hysteresis": "Comparator with hysteresis",
  "optocoupler-input": "Optocoupler input circuit",
};
