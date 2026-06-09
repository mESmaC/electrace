# Domain reputation & web-filter allowlisting

**Why this matters:** corporate web filters (Fortinet FortiGuard, Cisco, Palo Alto, Zscaler, …)
auto-block **newly registered / unrated domains** by category. On **2026-06-08**, days after going
live, `electrace.net` was block-paged by **Fortinet FortiGuard SDNS** as a newly-registered/unrated
domain — it served a "Fortiguard SDNS Blocked Page" cert instead of the real Vercel cert, and HSTS
(correctly) blocked any click-through. This silently locks out exactly our target buyer: **EEs on
corporate/enterprise networks**. The site itself is healthy; the problem is categorization.

The fix has two halves: (1) get `electrace.net` correctly rated in each major URL database, and
(2) domain hygiene that raises reputation so new-domain heuristics stop firing.

---

## 1. Recategorization submissions — do these now

For each vendor: look up `electrace.net`, then **request review / suggest category** =
**"Information Technology" / "Computers & Technology" / "Business"**. Submit **both** the apex
(`electrace.net`) and `www.electrace.net`. Most turn around in 1–3 days.

| Vendor | Filters it powers | Where to submit | Done |
|---|---|---|---|
| **Fortinet FortiGuard** | FortiGate firewalls, FortiGuard SDNS | fortiguard.com/webfilter → URL lookup → *Request Review* | [ ] |
| **Cisco Talos** | Cisco Secure Firewall, email/web reputation | talosintelligence.com/reputation_center → search → *Submit a Dispute* | [ ] |
| **Cisco Umbrella / OpenDNS** | Umbrella DNS filtering | domain.opendns.com (or Umbrella console) → category request | [ ] |
| **Palo Alto Networks** | PAN-OS, Prisma Access | urlfiltering.paloaltonetworks.com → *Test A Site* → *Request Change* | [ ] |
| **Zscaler** | Zscaler Internet Access | sitereview.zscaler.com → submit URL/category | [ ] |
| **Symantec / Broadcom (Blue Coat WebPulse)** | ProxySG, Web Security Service | sitereview.bluecoat.com → submit category | [ ] |
| **Forcepoint (Websense)** | Forcepoint Web Security | csi.forcepoint.com → URL category → submit | [ ] |
| **McAfee / Trellix (TrustedSource)** | McAfee/Skyhigh Web Gateway | trustedsource.org → check single URL → submit | [ ] |
| **Google Safe Browsing** | Chrome, Firefox, many | confirm NOT flagged: transparencyreport.google.com/safe-browsing/search | [ ] |
| **Microsoft Defender SmartScreen** | Edge, Defender | report as not-malicious if flagged | [ ] |

---

## 2. Domain hygiene that boosts reputation

- ✅ **Valid TLS + HSTS** (Vercel) — already good.
- ✅ **Permissive robots.txt** (`allow: /`, only `/api/` disallowed) so classifier crawlers can read
  the marketing pages and rate us as IT/EDA — already good.
- ✅ **Real company info + outbound link to usnylon.com** — helps human reviewers see a legitimate
  business (done 2026-06-08).
- [ ] **WHOIS**: keep a consistent, real registrant/org (US Nylon). Brand-new + fully privacy-proxied
  reads as higher-risk to some heuristics; a visible org or at least consistent data helps.
- [ ] **Email auth records even though we don't send much mail yet** — publish **SPF**
  (`v=spf1 -all` if not sending), **DKIM**, and a **DMARC** record (`v=DMARC1; p=reject; …`).
  A newly registered domain with no email authentication is an abuse signal to several filters.
- [ ] **Confirm not on spam/abuse blocklists** — Spamhaus DBL, SURBL, URIBL.
- [ ] **Let it age + accrue real traffic** — newly-registered-domain blocks expire on their own over
  days–weeks; the submissions above just accelerate it.

---

## 3. Status log

- **2026-06-08** — FortiGuard SDNS blocking `electrace.net` (newly registered / unrated). Identified via
  the served cert (`O=Fortinet, CN=Fortiguard SDNS Blocked Page`). Real Vercel deployment confirmed
  healthy (Google Trust Services `*.vercel.app` cert, app serving normally). Submissions pending — see §1.
- **Root cause = NRD window, confirmed by registration dates:** `electrace.net` registered **2026-06-07**
  (days old); `usnylon.com` registered **2026-04-22** (~7 weeks, never blocked). Filters auto-block
  domains younger than ~30 days (some 14/90) regardless of content. Expect the standard NRD block to
  **age out on its own ~2026-07-07**; the §1 submissions clear it sooner and cover longer-window filters.
