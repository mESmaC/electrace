/** Canonical site origin. The apex 308-redirects to www, so every URL we publish to crawlers
 *  (canonicals, sitemap, robots, JSON-LD, OG) must use WWW — a canonical that redirects is a
 *  conflicting signal that slows indexing. */
export const SITE = "https://www.electrace.net";
