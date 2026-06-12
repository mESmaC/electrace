import type { MetadataRoute } from "next";
import { listBlocks } from "@/lib/blocks";
import { blockImage } from "@/lib/blockImages";
import { COMPARISONS } from "@/lib/comparisons";
import { CHECK_DOCS } from "@/lib/checkDocs";
import { GLOSSARY } from "@/lib/glossary";

const CALC_SLUGS = ["led-resistor", "voltage-divider", "crystal-load-capacitor", "ntc-thermistor", "op-amp-gain", "motor-winding", "current-divider", "delta-wye", "lc-resonance", "ac-power", "ac-motor", "filter-designer", "parallel-resistor", "555-timer", "rc-filter", "ohms-law"];

const BASE = "https://www.electrace.net";
const NOW = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: NOW, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/blocks`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/help`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/docs/checks`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/glossary`, changeFrequency: "monthly", priority: 0.6 },
  ];
  // the public block explainer pages — the SEO/growth surface
  const blockPages: MetadataRoute.Sitemap = listBlocks().map((b) => {
    const img = blockImage(b.slug); // schematic PNG → image-sitemap entry (Google Images discovery)
    return {
      url: `${BASE}/blocks/${b.slug}`,
      lastModified: NOW,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      ...(img ? { images: [img] } : {}),
    };
  });
  const vsPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/vs`, lastModified: NOW, changeFrequency: "monthly", priority: 0.7 },
    ...COMPARISONS.map((c) => ({ url: `${BASE}/vs/${c.slug}`, lastModified: NOW, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
  const calcPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/calculators`, lastModified: NOW, changeFrequency: "monthly", priority: 0.7 },
    ...CALC_SLUGS.map((c) => ({ url: `${BASE}/calculators/${c}`, lastModified: NOW, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
  const checkPages: MetadataRoute.Sitemap = CHECK_DOCS.map((d) => ({
    url: `${BASE}/docs/checks/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.5,
  }));
const glossaryPages: MetadataRoute.Sitemap = GLOSSARY.map((t) => ({
    url: `${BASE}/glossary/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.5,
  }));
  return [...staticPages, ...blockPages, ...vsPages, ...calcPages, ...checkPages, ...glossaryPages];
}
