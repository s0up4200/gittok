# Research: iOS standalone PWA quirks for a vertical snap feed

Type: research
Status: resolved
Blocked by: 

## Question

For an installed (standalone) PWA on iOS Safari in 2026, what breaks in a full-screen vertical scroll-snap feed? Cover: `scroll-snap-type: y mandatory` behaviour and momentum, `100dvh` vs `100svh` in standalone mode, disabling pull-to-refresh and rubber-banding, safe-area insets with `viewport-fit=cover`, service worker and cache limits, the manifest fields iOS honours, and any open WebKit bugs that matter. Also confirm vite-plugin-pwa works when installed and run with bun. Prefer Apple, WebKit, MDN, and web.dev sources. Write findings to `.scratch/gittok/research/ios-pwa-quirks.md`.

## Answer

Findings: `.scratch/gittok/research/ios-pwa-quirks.md` (one source URL per claim, checklist at the end).

- Snap: iOS has no momentum in snap containers (bug 243582, open). One swipe moves one item. Add `scroll-snap-stop: always`. `scrollend` works from Safari 26.2; keep a timer fallback.
- Height: use `100dvh` in the browser and `100vh` under `@media (display-mode: standalone)`. With `viewport-fit=cover`, `svh`, `-webkit-fill-available`, `innerHeight`, and `visualViewport.height` exclude the insets (bugs 254868, 210009, open).
- Bounce: `overscroll-behavior: none` on `html`, `body`, and the feed, plus `body { overflow: hidden; position: fixed }`. Some end bounce stays (bug 240235, open).
- Safe area: `viewport-fit=cover` + `env(safe-area-inset-*)`. Use `display: standalone`, not `fullscreen`: 26.1/26.5.2/27 beta show the status bar and zero the top inset (bug 301994, reopened). No `position: fixed` overlays (bug 237961).
- Storage: installed app gets the browser quota (60 % of disk), keeps its own 7-day counter, and starts with empty caches (only cookies copy over).
- Manifest: iOS honours `display`, `id`, `icons`, `name`, `theme_color`, `start_url`. iOS 26 installs any site without a manifest. Keep the `apple-*` meta tags as fallback.
- Bun 1.4.0 runs vite-plugin-pwa; the docs list `bun create @vite-pwa/pwa`. Bun runs Vite on Node via its shebang, so no `--bun` flag is needed.
