# iOS standalone PWA quirks for a vertical snap feed

Date: 2026-09-01
Ticket: `.scratch/gittok/issues/04-ios-pwa-quirks.md`
Scope: installed (Home Screen) web app on iOS 26.x. Primary sources only.

## 1. Scroll snap and momentum

- iOS does not do momentum scrolling in a scroll-snap container. When the finger lifts, WebKit snaps to the next item at once. The bug is open (status NEW). Filed 2022-08-05. Last comment 2026-04-16. Simon Fraser wrote in 2026 that the wanted behaviour is "normal momentum scroll and then retargeting near the end". There is no workaround.
  Source: https://bugs.webkit.org/show_bug.cgi?id=243582
- Result for a feed: one swipe moves one item. This is what a TikTok-style feed wants. Do not add JavaScript to emulate fling.
- `scroll-snap-stop: always` works during momentum scrolling since WebKit r274726 (2021-03-19). Use it so a fast swipe cannot skip an item.
  Sources: https://bugs.webkit.org/show_bug.cgi?id=223406 , https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-stop
- `scroll-snap-type` is Baseline since April 2022. The spec leaves the snap physics to the browser.
  Source: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type
- `element.scrollIntoView()` inside a `scroll-snap-type: y mandatory` container failed on iOS after the browser UI collapsed. Fixed by PR #64111, merged 2026-05-04. It is not in the Safari 26.4/26.5/26.6 notes. Treat programmatic scroll as risky on iOS 26.x and test it on a device.
  Source: https://bugs.webkit.org/show_bug.cgi?id=245722
- Safari 26.5 fixed "scroll-snap re-snapping after layout changes could cause incorrect scroll positions". Keep item heights stable while the feed is visible. Do not change layout inside a snap container during a scroll.
  Source: https://webkit.org/blog/17938/webkit-features-for-safari-26-5/
- Layout during scroll causes jitter on iOS (long-standing bug 173887). Do not trigger layout from `scroll` handlers.
  Source: https://bugs.webkit.org/show_bug.cgi?id=173887
- `scrollend` fires in Safari 26.2 and later. Use it to detect "settled on item N". Keep a `scroll` + timer fallback for iOS 26.0/26.1.
  Source: https://webkit.org/blog/17640/webkit-features-for-safari-26-2/

## 2. `100dvh` versus `100svh` in standalone mode

- Definitions: `100svh` is the smallest possible viewport, `100lvh` the largest, `100dvh` changes as the user scrolls. Shipped in Safari 15.4.
  Source: https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/
- `dvh` values are throttled and do not update at 60 fps. Some browsers debounce them per gesture.
  Source: https://web.dev/blog/viewport-units
- Bug 261185 (`svh` and `dvh` equal when the tab bar is hidden) is RESOLVED FIXED (2023-11-13). Do not cite it as open. In standalone mode there is no collapsing browser UI, so `svh`, `lvh`, and `dvh` are the same height by design.
  Source: https://bugs.webkit.org/show_bug.cgi?id=261185
- Open bug 254868 (NEW, last comment 2025-04-18): in an installed web app with `viewport-fit=cover`, `100svh`, `-webkit-fill-available`, and `visualViewport.height` report the height minus the safe-area insets. `100vh` includes the insets. Workaround from the report: use `100vh` in `@media (display-mode: standalone)`.
  Source: https://bugs.webkit.org/show_bug.cgi?id=254868
- Related open bugs: 237961 (`position: fixed; bottom: 0` leaves a gap in standalone with `viewport-fit=cover`; NEW) and 210009 (`window.innerHeight` excludes insets with `viewport-fit=cover`; NEW, last comment 2025-11-18).
  Sources: https://bugs.webkit.org/show_bug.cgi?id=237961 , https://bugs.webkit.org/show_bug.cgi?id=210009
- Decision for the feed: size the feed container with `height: 100dvh` in the browser and `height: 100vh` under `@media (display-mode: standalone)`. Do not use `-webkit-fill-available`. Do not read `visualViewport.height` or `window.innerHeight` to size items.

## 3. Pull-to-refresh and rubber-banding

- `overscroll-behavior` shipped on iOS in Safari 16.0. The iOS implementation sets UIKit bounce and parent-scroll flags from the CSS value.
  Sources: https://webkit.org/blog/13152/webkit-features-in-safari-16-0/ , https://bugs.webkit.org/show_bug.cgi?id=233788
- Safari 16.4 fixed `overscroll-behavior: none` when the page is too small to scroll.
  Source: https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- MDN: `contain` keeps the bounce inside the element and stops scroll chaining. It also disables pull-to-refresh and horizontal swipe navigation. `none` stops both chaining and the bounce.
  Source: https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior
- Open bug 240235 (NEW): `overscroll-behavior: none` does not stop rubber-banding reliably in scroll-snap containers, mostly on fast scrolls at the ends. Filed 2022-05-09. No fix. Expect some bounce at the first and last item.
  Source: https://bugs.webkit.org/show_bug.cgi?id=240235
- `<body>` with `overflow: hidden` was scrollable in standalone mode. Fixed in r293188 (2022-04-21).
  Source: https://bugs.webkit.org/show_bug.cgi?id=220908
- Bug 222654 (NEW, last comment 2026-06-09): in Home Screen web apps scrolling latched to the document instead of the inner scroller, and a UIKit bug blocks inner scrolling while an ancestor rubber-bands. A 2026 comment reports it fixed in iOS 18.7.8 and later. Workaround from the thread: `body { overflow: hidden; width: 100%; height: 100%; overscroll-behavior: none; }`.
  Source: https://bugs.webkit.org/show_bug.cgi?id=222654
- No Apple or WebKit page documents a pull-to-refresh gesture for Home Screen web apps. Do not depend on its presence or absence. `overscroll-behavior: none` on `html`, `body`, and the feed removes the gesture where it exists.

## 4. Safe-area insets with `viewport-fit=cover`

- `viewport-fit=cover` lays the page out to the full screen. `env(safe-area-inset-top|right|bottom|left)` gives the inset on each side. Use `max()` to take the larger of a default padding and the inset. `constant()` is dead since iOS 11.2.
  Source: https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- `env()` accepts a fallback: `env(safe-area-inset-bottom, 0px)`. `safe-area-max-inset-*` gives the static maximum.
  Source: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- Bug 301994 (REOPENED, last comment 2026-08-28): since iOS 26.1, `display: fullscreen` web apps keep the status bar visible and `env(safe-area-inset-top)` becomes 0, which leaves a gap. Fixed in 26.2, back in 26.5.2 and iOS 27 beta. Decision: use `display: standalone`, not `fullscreen`, and draw the feed under the status bar with the inset.
  Source: https://bugs.webkit.org/show_bug.cgi?id=301994
- Bug 217754 (NEW): `safe-area-inset-bottom` stays set while the keyboard is open. The feed has no text input, so this does not apply. Note it for the comment or search screen.
  Source: https://bugs.webkit.org/show_bug.cgi?id=217754
- Bug 297779 (fixed elements jump when scroll direction changes) is RESOLVED MOVED. Safari fixed it in iOS 26.1. WKWebView is still affected. Prefer `position: sticky` or in-flow layout for overlays in the feed.
  Source: https://bugs.webkit.org/show_bug.cgi?id=297779
- `theme-color` (meta tag or manifest) colours the status bar and overscroll area on iOS 15 and later. The meta tag accepts a `media` attribute for light and dark.
  Source: https://webkit.org/blog/11989/new-webkit-features-in-safari-15/

## 5. Service worker and cache limits

- Origin quota on iOS 17 and later: up to 60 % of disk for browser apps. A Home Screen web app gets the same quota as the browser. Overall cap is 80 % of disk. Eviction is per origin, least recently used.
  Sources: https://webkit.org/blog/14403/updates-to-storage-policy/ , https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Seven-day rule: script-written storage is deleted after seven days of Safari use with no interaction on the site. Home Screen web apps are not part of Safari and keep their own day counter. WebKit says it does not expect first-party data in a Home Screen web app to be deleted, and calls a deletion "a serious bug".
  Source: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- A Home Screen web app has storage separate from Safari. Only cookies are copied at install time. Service workers, cache storage, IndexedDB, and localStorage start empty in the installed app.
  Source: https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
- Safari 26.6 (2026-07-27): service worker registrations with a missing main script or a missing imported script are now unregistered automatically. Before this, a broken deploy could pin a stale worker.
  Source: https://webkit.org/blog/18178/webkit-features-for-safari-26-6/

## 6. Manifest fields iOS honours

- iOS 26: every site added to the Home Screen opens as a web app by default. The user can turn "Open as Web App" off. A manifest is not required for install. A manifest still provides its features when present.
  Source: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Manifest members documented as honoured on iOS: `display` (`standalone` or `fullscreen`, since 16.4 blog), `id` (16.4), `icons` (15.4), `name`, `theme_color`, `start_url` (17.0). `scope` is documented for link capture on macOS in Safari 18.0 only.
  Sources: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ , https://webkit.org/blog/13966/webkit-features-in-safari-16-4/ , https://webkit.org/blog/14445/webkit-features-in-safari-17-0/ , https://webkit.org/blog/15865/webkit-features-in-safari-18-0/
- `orientation`, `background_color`, `shortcuts`, and `display_override` are not documented for iOS in these sources. Do not depend on them.
- Web Push and the Badging API work in Home Screen web apps since iOS 16.4. Notification permission also grants badging.
  Source: https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- Apple meta tags still work: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon`, `apple-touch-startup-image`. `window.navigator.standalone` reports standalone mode.
  Source: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- The 16.4 Web Push post says a site with only the meta tag and no manifest `display` opens as a bookmark in the default browser. Ship the manifest; keep `apple-touch-icon` as the icon fallback.
  Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## 7. Open WebKit bugs that matter (2026-09-01)

| Bug | Status | Effect on the feed |
|---|---|---|
| 243582 | NEW | No momentum in snap containers. One swipe = one item. |
| 240235 | NEW | Bounce at the ends despite `overscroll-behavior: none`. |
| 254868 | NEW | `svh` and `visualViewport.height` exclude insets in standalone with `viewport-fit=cover`. Use `100vh`. |
| 237961 | NEW | `position: fixed; bottom: 0` gap in standalone. Use sticky or in-flow. |
| 210009 | NEW | `window.innerHeight` excludes insets. Do not size from it. |
| 301994 | REOPENED | `display: fullscreen` shows the status bar and zeroes the top inset on 26.1, 26.5.2, 27 beta. Use `standalone`. |
| 222654 | NEW (reported fixed in 18.7.8+) | Scroll latches to document in Home Screen apps. Lock `body`. |
| 217754 | NEW | Bottom inset stays with keyboard. Not relevant to the feed. |

Fixed and no longer relevant: 261185, 220908, 223406, 297779 (Safari), 245722 (merged 2026-05-04, ship date unknown).

## 8. vite-plugin-pwa with bun

- The Vite PWA docs list bun with pnpm, yarn, and npm: `bun create @vite-pwa/pwa` and `bun create @vite-pwa/pwa my-app --template <name>`. The plugin registers as `VitePWA({ registerType: 'autoUpdate' })` in `vite.config.ts`. Node 18 or 20+ is the stated requirement.
  Sources: https://vite-pwa-org.netlify.app/guide/ , https://vite-pwa-org.netlify.app/guide/scaffolding
- Bun runs Vite. `bun run dev` and `bun run build` execute the package scripts. Bun respects Vite's `#!/usr/bin/env node` shebang by default, so Vite runs on Node unless `--bun` is passed.
  Sources: https://bun.com/docs/guides/ecosystem/vite , https://bun.com/docs/cli/run
- Bun does not run lifecycle scripts by default. `esbuild` is on the default trusted list. A custom `trustedDependencies` list replaces the default list. vite-plugin-pwa itself has no install script that the docs require.
  Source: https://bun.com/docs/install/lifecycle
- Local: `bun --version` returns `1.4.0`.
- Verdict: works. Install with `bun add -D vite-plugin-pwa`, run with `bun run build`. Do not pass `--bun` unless a later test shows Node is not on the machine.

## 9. Checklist for the scaffold

HTML `<head>`:

- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- [ ] `<meta name="theme-color" content="#000000">` (add a second tag with `media="(prefers-color-scheme: light)"` if the shell is not always dark)
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes">`
- [ ] `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- [ ] `<meta name="apple-mobile-web-app-title" content="gittok">`
- [ ] `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`
- [ ] `<link rel="manifest" href="/manifest.webmanifest">` (vite-plugin-pwa injects this)

Manifest (vite-plugin-pwa `manifest` option):

- [ ] `name`, `short_name`
- [ ] `id: "/"`
- [ ] `start_url: "/"`
- [ ] `display: "standalone"` (not `fullscreen`, bug 301994)
- [ ] `theme_color`, `background_color`
- [ ] `icons`: 192 and 512 PNG, plus one `purpose: "maskable"`
- [ ] `registerType: 'autoUpdate'`

CSS:

- [ ] `html { overflow: hidden; overscroll-behavior: none; }` and a plain `body { margin: 0 }`
- [ ] Do NOT fix or clip `body`. Verified on iOS 27 (2026-09-01): a `position: fixed; inset: 0` body is 62 px shorter than the view (`innerHeight` 894 versus `100vh` 956 on an iPhone 16 Pro Max, bug 210009), so it clips the card bottom or leaves a black strip. Clip on `html` only, size the feed with `100vh` in standalone.
- [ ] `.feed { height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; overscroll-behavior: none; -webkit-overflow-scrolling: touch; }`
- [ ] `@media (display-mode: standalone) { .feed { height: 100vh; } }` (bug 254868)
- [ ] `.feed > .item { height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }`
- [ ] Overlays inside an item use `position: absolute` with `padding-top: env(safe-area-inset-top, 0px)` and `padding-bottom: max(16px, env(safe-area-inset-bottom, 0px))`. No `position: fixed` (bug 237961).
- [ ] No `-webkit-fill-available`. No sizing from `window.innerHeight` or `visualViewport.height`.
- [ ] Do not change item height or layout while the feed is on screen (26.5 re-snap fix, bug 173887).
- [ ] Item detection: `scrollend` when available, else `scroll` + 100 ms timer.

Test on device:

- [ ] Install from Safari on iOS 26.x. Confirm `navigator.standalone === true` and `matchMedia('(display-mode: standalone)').matches`.
- [ ] Swipe at the first and last item. Some bounce is expected (bug 240235).
- [ ] Confirm the top overlay sits below the status bar and the bottom overlay sits above the home indicator.
- [ ] Confirm the service worker caches after a cold launch of the installed app (storage is separate from Safari).
