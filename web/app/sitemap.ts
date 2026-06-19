import type { MetadataRoute } from "next";
import { listBlocks } from "@/lib/blocks";
import { blockImage } from "@/lib/blockImages";
import { COMPARISONS } from "@/lib/comparisons";
import { CHECK_DOCS } from "@/lib/checkDocs";
import { GLOSSARY } from "@/lib/glossary";
import { supabaseAdmin } from "@/lib/supabase/admin";

// User-published designs are the only UGC SEO surface: each is a long-tail landing page that ends
// in "Start your own design →". PUBLIC only (unlisted = "anyone with the link", kept out of the
// index, same as the share page's robots rule). Service-role read, filtered to public; never throws
// the sitemap.
async function publicDesignPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const admin = supabaseAdmin();
    if (!admin) return [];
    const { data } = await admin
      .from("designs").select("id, updated_at").eq("visibility", "public")
      .order("updated_at", { ascending: false }).limit(5000);
    return (data ?? []).map((d: { id: string; updated_at: string }) => ({
      url: `${BASE}/share/${d.id}`,
      lastModified: new Date(d.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch { return []; }
}

const CALC_SLUGS = ["led-resistor", "voltage-divider", "crystal-load-capacitor", "ntc-thermistor", "op-amp-gain", "motor-winding", "current-divider", "delta-wye", "lc-resonance", "ac-power", "ac-motor", "filter-designer", "parallel-resistor", "555-timer", "rc-filter", "ohms-law"];

const BASE = "https://www.electrace.net";
const NOW = new Date();
export const revalidate = 3600; // refresh the public-design list hourly without needing a redeploy

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  const sharePages = await publicDesignPages();
  return [...staticPages, ...blockPages, ...vsPages, ...calcPages, ...checkPages, ...glossaryPages, ...sharePages];
}
