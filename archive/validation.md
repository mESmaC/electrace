# Validation Plan

_Goal: cheaply prove people care **before** sinking months into the full product. Runs in
parallel with the demo build (see [demo-plan.md](demo-plan.md)) — the demo is the
validation artifact. Positioning and copy live in [pitch.md](pitch.md)._

## The one assumption that gates everything

> **Learner-to-intermediate, discrete-friendly electronics people feel the "I place ICs I
> don't really understand / my schematic is a pile of black boxes" pain strongly enough to
> adopt — and eventually pay for — a tool that fixes it.**

Everything else (can we build it, is there white space) is already answered. This is the
*only* thing that killed Geppetto-style bets: demand that looked real but didn't convert.
We test this directly, with strangers, fast.

## What we are NOT testing yet
- Whether the full IDE works (we test one chain).
- Whether kitting/ordering sells (later margin layer — don't muddy the signal).
- Whether pros/companies want it (wrong audience for v1; chasing them dilutes the message).

## Method — three cheap probes, run together over ~3 weeks

### Probe 1 — Landing page + waitlist (passive demand)
- One page, the "nothing is a black box" message, an embedded **demo GIF/video** of the
  hover-explain + lint interaction, and an email capture. Copy from [pitch.md](pitch.md).
- Instrument it: track visits → email signups (conversion %), and where traffic came from.
- **The demo clip is the hook — post the interaction, never the idea.** People can't react
  to a concept; they react to seeing a block explain itself.

### Probe 2 — Community drops (active demand + qualitative)
Post the demo clip (not a "would you use this?" survey) to where the audience actually is:
- **Reddit:** r/AskElectronics, r/PrintedCircuitBoard, r/ECE, r/AskEngineers, r/diyelectronics
- **Forums:** EEVblog forum, Hackaday (tip line / project page), All About Circuits forum
- **Chat:** embedded/electronics Discords & the KiCad community spaces
- **Later, not now:** Show HN / Hacker News — save it for when the demo is polished; HN is a
  one-shot and skews pro. Same for Product Hunt.
- Measure: upvotes/engagement, but mostly **read the comments** — are people saying "I need
  this" / "when can I use it" / "does it do X," or just "neat"? Save every quote.

### Probe 3 — 10-15 problem interviews (the real signal)
Talk to actual target users (find them in the threads above + your own network). Use
**Mom-Test discipline**: ask about their *past behavior and current pain*, never pitch.
Good questions:
- "Walk me through the last schematic you built. Where did you get stuck or unsure?"
- "When you drop in an IC, how often do you actually understand what's inside? Does that
  bother you, or not really?"
- "What do you do today when you don't understand a part of a circuit?" (datasheet?
  YouTube? ask a friend? give up and trust it?)
- "Last time you wanted to go discrete instead of an IC — what made you, and what was
  annoying about it?"
- "Have you ever paid for an electronics tool? Which, and why that one?"
- The pull test, at the very end: "If something fixed that, would you want me to send it to
  you when it's ready?" — then watch whether they actually give you their email / follow up.

## Go / pivot / no-go thresholds (directional, not gospel)

| Signal | No-go | Promising | Strong |
|---|---|---|---|
| Landing conversion (cold traffic) | <5% | 10-20% | >25% |
| Waitlist signups in 3 wks | <50 | 150-400 | >500 |
| Interview "send it to me" pull | <3/15 unprompted | 6-9/15 | >10/15 |
| Comment sentiment | "neat" / crickets | several "I'd use this" | unprompted "how do I pay / when" |

- **Strong on ≥2 rows → build the real product**, start charging-intent experiments.
- **Promising → narrow the wedge** (maybe it's *only* learners, or *only* power supplies)
  and re-test.
- **No-go across the board → the pain isn't sharp enough as framed**; either reframe the
  wedge or shelve it. Better to learn this in 3 weeks than 9 months.

## Pricing probe (lightweight, week 3)
Once there's a waitlist, email them a one-question pricing read: "Would this be most useful
as (a) free + paid pro tier, (b) one-time purchase, (c) free, you pay only when you order
hardware?" — learns the *model*, not the number. Don't overthink price yet; learn shape.

## Timeline (you're going hard — 3-week sprint, parallel tracks)
- **Wk 1:** demo slice playable enough to screen-record (see demo-plan) + landing page live
  + interview outreach started.
- **Wk 2:** community drops staggered (don't blow all channels at once — space them so you
  can A/B the clip and the headline); run interviews.
- **Wk 3:** pricing probe to waitlist; compile quotes + metrics; make the go/pivot/no-go
  call against the table above.

## What "winning" this phase looks like
Not a finished product. A **decision backed by evidence**: a wedge that pulls, a list of
real people who want it, the exact words they use for the pain (→ becomes your marketing),
and a defensible read on the business model. That's what de-risks everything after.
