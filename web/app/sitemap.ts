import type { MetadataRoute } from "next";
import { listBlocks } from "@/lib/blocks";
import { COMPARISONS } from "@/lib/comparisons";

const CALC_SLUGS = ["led-resistor", "voltage-divider", "crystal-load-capacitor", "ntc-thermistor", "op-amp-gain"];

const BASE = "https://www.electrace.net";
const NOW = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: NOW, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/blocks`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/help`, changeFrequency: "weekly", priority: 0.6 },
  ];
  // the public block explainer pages — the SEO/growth surface
  const blockPages: MetadataRoute.Sitemap = listBlocks().map((b) => ({
    url: `${BASE}/blocks/${b.slug}`,
    lastModified: NOW,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const vsPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/vs`, lastModified: NOW, changeFrequency: "monthly", priority: 0.7 },
    ...COMPARISONS.map((c) => ({ url: `${BASE}/vs/${c.slug}`, lastModified: NOW, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
  const calcPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/calculators`, lastModified: NOW, changeFrequency: "monthly", priority: 0.7 },
    ...CALC_SLUGS.map((c) => ({ url: `${BASE}/calculators/${c}`, lastModified: NOW, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
  return [...staticPages, ...blockPages, ...vsPages, ...calcPages];
}
