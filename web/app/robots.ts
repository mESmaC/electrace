import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // App/auth surfaces are noise to crawlers: protected routes 302 to /login (SEMrush flagged
      // 53 temp-redirect URLs from ?next= variants), and auth forms have no search value.
      // /editor stays crawlable — it's the public sandbox.
      { userAgent: "*", allow: "/", disallow: ["/api/", "/shorts-stage/", "/login", "/signup", "/projects", "/settings", "/welcome"] },
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
