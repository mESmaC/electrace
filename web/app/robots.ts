import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      // Training-corpus crawlers: the explainer corpus is the product — don't donate it to model
      // training. Search/citation bots (Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, the
      // user-triggered fetchers) stay allowed: they send traffic and cite us.
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "Applebot-Extended", disallow: "/" },
      { userAgent: "meta-externalagent", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: "https://www.electrace.net/sitemap.xml",
    host: "https://www.electrace.net",
  };
}
