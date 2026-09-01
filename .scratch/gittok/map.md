# GitTok map

Label: wayfinder:map
Tracker: local markdown (`.scratch/gittok/`). Research findings live in `.scratch/gittok/research/<name>.md`. The repo has a git history from the scaffold ticket onward.

## Destination

A spec, ready to hand to `/implement`, for GitTok: a mobile-first PWA that shows your GitHub feed as full-screen cards you swipe through vertically, one event per card.

## Notes

- Personal tool for one user first. Open source and self-hostable: each person runs their own copy with their own token.
- Auth: paste a personal access token. No backend. Static host on GitHub Pages under `s0up4200/gittok`.
- Feed sources: `GET /users/{me}/received_events` plus release events from starred repos.
- Card actions for v1: star the repo, open on GitHub.
- Stack: Vite + React + TypeScript, bun as package manager and runner, vite-plugin-pwa. Cache the last fetched feed so the app opens offline with stale cards.
- Target: iOS Safari, installed to home screen (standalone), portrait first. Follow the `mobile-adapt` skill on every UI decision.
- Prototypes are real React in this repo, not throwaway HTML.
- Skills every session consults: `grilling`, `domain-modeling`, `mobile-adapt`, `ponytail`. Glossary lives in `CONTEXT.md`.
- When the last ticket closes, write the spec with `/to-spec` from the decisions below.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->
- [Research: Events API limits and polling](issues/01-events-api-limits.md): 30-day window and 300-event cap, `per_page` max 100, events lag 30s to 6h, ETag 304 is free only with an Authorization header, obey `X-Poll-Interval`, PushEvent payload has no commit list. Details in [research/events-api-limits.md](research/events-api-limits.md).
- [Research: cheapest way to fetch releases for N starred repos](issues/03-starred-releases.md): one GraphQL query over `viewer.starredRepositories(first: 100)` with `latestRelease`, 1 point per 100 repos, CORS works from a browser. REST is 303 requests for 300 repos. `received_events` does not cover starred repos. Untested with a real token: `isOverLimit` threshold, prerelease handling, fine-grained PAT permission for GraphQL. Details in [research/starred-releases.md](research/starred-releases.md).
- [Research: PAT scopes for feed, starred list, and starring](issues/02-pat-scopes.md): classic token needs `public_repo` (`repo` for private). Fine-grained token: Starring read+write, resource owner = user, `received_events` documented as needing no permission but unverified with a real token. Missing scope gives 403/404, bad token 401, read `X-Accepted-OAuth-Scopes` on error. Details in [research/pat-scopes.md](research/pat-scopes.md).
- [Research: iOS standalone PWA quirks for a vertical snap feed](issues/04-ios-pwa-quirks.md): snap containers have no momentum on iOS, add `scroll-snap-stop: always`; use `100dvh` in browser and `100vh` in standalone; `overscroll-behavior: none` plus fixed body for bounce; `display: standalone` not `fullscreen`; avoid `position: fixed` overlays; installed app starts with empty caches and has its own 7-day storage counter; bun 1.4.0 runs vite-plugin-pwa with no `--bun` flag. Scaffold checklist at the end of [research/ios-pwa-quirks.md](research/ios-pwa-quirks.md).
- [Which event types become cards](issues/05-event-types.md): keep Release, Push, PR opened/merged, Issues opened, Watch, Fork, Create (repository), Public. Drop the rest silently. Three card shapes: Repo, Change, Release. Push cards lazy-fetch the compare endpoint for commit messages.
- [Feed order and same-repo collapse](issues/06-feed-order.md): newest first, no ranking. Pushes collapse per repo+actor+ref within 6h into one card with one compare request. Stars and forks collapse per repo+type within 24h. Releases dedupe by id. Card id = newest event id in the group.
- [Seen state and resume position](issues/07-seen-state.md): seen = swiped past or 1s fully visible. Seen ids in localStorage, pruned to 30 days, capped at 1000. Seen cards hidden, feed always starts at top, "caught up" empty state. Settings has "Mark all unseen".
- [Scaffold the app shell](issues/08-scaffold-app.md): Vite 8 + React 19 + TS via bun, vite-plugin-pwa 1.3.0 with standalone manifest, shell CSS from the iOS checklist, three placeholder cards. Builds clean. `git init` done, nothing committed.
- [Card layout prototype](issues/09-card-prototype.md): variant J wins. TikTok rail layout, blurred actor avatar as colour wash, big event type label and stats row at top, body bottom-left, Star and Open as round buttons bottom-right. Prototype in `src/PrototypeFeed.tsx`, to move to a `prototype/card-layout` branch at first commit.
- [Task: verify token access with a real PAT](issues/10-verify-token-access.md): classic `public_repo` does everything (feed, starred list, GraphQL, star write). Fine-grained reads all of it, star write returned 403 with the tested permission. Settings asks for classic `public_repo`. `isOverLimit` false at 436 stars.
- [App shell: states and gestures](issues/11-app-shell.md): cached cards on open, skeleton card when empty. Caught-up card at feed end with Refresh. Error and offline cards in the same shape. Refetch on open and visibility. "N new" pill at top. Gear icon top-right. One-time install hint in Safari. Same layout in landscape.
- [Settings screen and star action](issues/12-settings-and-star.md): full-screen `/settings` route with token input, create-token link, login confirmation, Mark all unseen, Sign out. Token in localStorage. 401 and 403 become end cards. Star state from the starred query, optimistic toggle with revert toast.
- [Fetch plan for both sources](issues/13-fetch-plan.md): cached feed first, then page 1 of events and starred, rest in background, starred capped at 1000. Repo stats via aliased GraphQL, 50 repos per query. No polling; refetch on visibility and Refresh, 60 s throttle. Feed blob in localStorage, avatars via workbox CacheFirst. Stop lazy fetches under 100 rate-limit points.

## Not yet specified

None. The way to the spec is clear.

## Out of scope

- GitHub OAuth login. Needs a backend or worker; PAT covers a personal tool.
- Notifications API as a feed source.
- Comments, replies, or any write action other than star.
- Multiple GitHub accounts.
- A native app.
- The user's own activity (`GET /users/{me}/events`) as a feed source. Decided in [Which event types become cards](issues/05-event-types.md).
- Post-v1, for a later effort: Android and Chromium polish, repo-aggregated cards, extra card actions (follow, share, save), a "show seen" toggle. Ruled out when the last ticket closed so the v1 spec has a fixed edge.
