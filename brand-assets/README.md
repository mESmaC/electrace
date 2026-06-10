# Electrace brand assets (YouTube)

Generated from the real design system: LogoMark from `web/app/Logo.tsx`, dark palette
(`#161b22` / `#11151b`), accent `#4c8dff`, JetBrains Mono wordmark + caret, Inter body.

| File | Size | Use |
|---|---|---|
| `profile.png` | 800×800 | Channel profile picture (YouTube circle-crops it — the mark is centered safe) |
| `banner.png` | 2560×1440 | Channel banner. Lockup + tagline sit inside the 1546×423 "all devices" safe zone; the resistor traces are desktop-only decoration |
| `watermark.png` | 150×150 | Video watermark (transparent). White ring + accent trace — designed for the dark app footage it will sit on |
| `thumbnail.png` | 1280×720 | Thumbnail TEMPLATE — edit the title in `thumbnail.html`, re-screenshot |

## Regenerating / making a new thumbnail

Edit the HTML (the title text in `thumbnail.html`), then:

```sh
google-chrome --headless=new --disable-gpu --window-size=1280,720 \
  --screenshot=thumbnail.png thumbnail.html
```

(watermark needs `--default-background-color=00000000` for transparency;
banner is `--window-size=2560,1440`, profile `800,800`.)
