# GitTok v1 spec

Status: ready-for-agent
Map: [map.md](map.md). Every decision below links to the ticket that holds its detail. Glossary: `CONTEXT.md` at the repo root.

## Problem Statement

GitHub's feed is a dense web page built for a desktop browser. On a phone it is a wall of small text with no rhythm. Releases from repos I star do not show in it at all, because starring is not watching. I want to catch up on what the people I follow and the repos I star did, one thing at a time, with my thumb, the way TikTok works.

## Solution

GitTok is a mobile-first PWA installed to the iPhone Home Screen. It shows the Feed as full-screen Cards. One swipe up shows the next Card. Each Card is one Event (or one Group of related Events) from two Sources: activity from watched repos and followed users, and releases from starred repos. Two actions on every Card: star the repo, open it on GitHub. Seen Cards leave the Feed, so opening the app always starts at the newest unseen thing and ends at a "caught up" End card.

The app is static, open source, and self-hosted. Each person runs their own copy with their own GitHub personal access token. No backend.

## User Stories

1. As a GitHub user, I want to see events from the users I follow and the repos I watch as full-screen cards, so that I can read one thing at a time on my phone.
2. As a GitHub user, I want releases from repos I star to appear in the same feed, so that I do not miss a release from a project I care about but do not watch.
3. As a GitHub user, I want to swipe up to move to the next card and swipe down to go back, with one swipe moving exactly one card, so that navigation feels like a short-video app.
4. As a GitHub user, I want the newest card first, so that the top of the feed is always the freshest activity.
5. As a GitHub user, I want cards I have swiped past to disappear from the feed, so that I never re-read what I have already seen.
6. As a GitHub user, I want a card I held in view for a second to count as seen even if I did not swipe, so that a card I paused on is not shown again.
7. As a GitHub user, I want a "caught up" card at the end of the feed with the time of the last check and a Refresh button, so that I know I am done and can look again.
8. As a GitHub user, I want to see who did what and when at a glance (actor, verb, repo, relative time), so that I can decide in a second whether to read on.
9. As a GitHub user, I want release cards to show the tag and the release notes, so that I can judge a release without opening GitHub.
10. As a GitHub user, I want push cards to show the commit messages, so that "pushed to main" means something.
11. As a GitHub user, I want several pushes to the same branch by the same person within a few hours merged into one card, so that a busy contributor does not flood my feed.
12. As a GitHub user, I want several people starring or forking the same repo in a day merged into one card that lists them, so that a trending repo shows as one thing.
13. As a GitHub user, I want a release that reaches me both from a watched repo and from my starred list shown once, so that I never see duplicates.
14. As a GitHub user, I want PR cards for opened and merged pull requests only, so that label and assignee churn stays out of my feed.
15. As a GitHub user, I want issue cards for opened issues only, so that I see new problems without the noise of every comment.
16. As a GitHub user, I want repo cards for stars, forks, new repos, and repos that went public, showing description, stars, forks, open issues, and language, so that I can judge a repo from the card.
17. As a GitHub user, I want comment, review, wiki, delete, and membership events left out, so that the feed stays about things worth swiping to.
18. As a GitHub user, I want every card to have a colour wash from the actor's avatar and a large event type label, so that cards feel distinct and the screen is never empty.
19. As a GitHub user, I want Star and Open buttons stacked at the bottom right, so that I can reach them with my thumb one-handed.
20. As a GitHub user, I want a tap on Star to light up at once and unstar on a second tap, so that starring feels instant.
21. As a GitHub user, I want a failed star to revert with a short message, so that I am not misled about what I starred.
22. As a GitHub user, I want to see at once whether I already star the repo on a card, so that I do not star it twice.
23. As a GitHub user, I want Open to take me to the repo, release, PR, or issue on GitHub in the browser, so that I can go deeper when a card is interesting.
24. As a GitHub user, I want a gear icon on every card that opens settings, so that settings are always one tap away.
25. As a GitHub user, I want to paste a GitHub personal access token in settings and see my login and avatar as confirmation, so that I know the token works.
26. As a GitHub user, I want a link that opens GitHub's new-token page with the right scope pre-filled, so that I do not have to read docs to make a token.
27. As a GitHub user, I want the app to open straight to settings on first run, so that I am not shown an empty feed.
28. As a GitHub user, I want a clear card telling me the token was rejected or lacks the scope, with a button to settings, so that I know what to fix.
29. As a GitHub user, I want a "Mark all unseen" button, so that I can replay the feed.
30. As a GitHub user, I want a "Sign out" button that clears the token, seen state, and cached feed, so that I can hand my phone to someone or start over.
31. As a GitHub user, I want the app to show the last feed at once when I open it, and slot new cards in on top when the fetch lands, so that it feels instant and works offline.
32. As a GitHub user, I want a skeleton card while the first fetch runs when nothing is cached, so that the app never looks broken.
33. As a GitHub user, I want a small "offline" marker when I have no network but a cached feed, so that I know why nothing new appears.
34. As a GitHub user, I want a "N new" pill at the top when new cards arrive mid-session, so that I can jump to them without losing my place.
35. As a GitHub user, I want the app to refetch when I return to it, so that I do not have to press Refresh.
36. As a GitHub user, I want a rate-limit card with the reset time when GitHub cuts me off, so that I know it is not the app's fault.
37. As a GitHub user, I want the app to stop optional fetches when my rate limit runs low, so that the feed itself keeps working.
38. As a GitHub user, I want a one-time hint to add the app to my Home Screen when I open it in Safari, so that I get the full-screen version.
39. As a GitHub user with large text turned on, I want cards to wrap and reflow instead of truncating, so that I can still read them.
40. As a GitHub user, I want the same single-card layout when I rotate the phone, so that nothing jumps around.
41. As a GitHub user with hundreds of starred repos, I want the app to page through my stars in the background up to a cap and tell me in settings when it hit the cap, so that a huge star list does not stall the feed.
42. As a self-hoster, I want a static build that deploys to GitHub Pages or any static host, so that running my own copy costs nothing.
43. As a self-hoster, I want the app to hold no credentials but my own token in my own browser, so that there is nothing to leak server-side.

## Implementation Decisions

Each decision links to the ticket that holds the full reasoning.

### Sources and event types

- Two Sources ([Which event types become cards](issues/05-event-types.md), [Research: cheapest way to fetch releases for N starred repos](issues/03-starred-releases.md)):
  - Received events: `GET /users/{me}/received_events`. Watched repos and followed users. At most 300 events and 30 days ([Research: Events API limits and polling](issues/01-events-api-limits.md)).
  - Starred releases: one GraphQL query over `viewer.starredRepositories` ordered by `STARRED_AT` descending, 100 per page, with `latestRelease`, `stargazerCount`, `forkCount`, open issue count, `primaryLanguage`, and `viewerHasStarred`.
- Kept event types and their Card shape:

  | Type | Filter | Card shape |
  |---|---|---|
  | ReleaseEvent | all | Release |
  | PushEvent | all | Change |
  | PullRequestEvent | `opened`, or `closed` with `merged == true` | Change |
  | IssuesEvent | `opened` | Change |
  | WatchEvent | all | Repo |
  | ForkEvent | all | Repo |
  | CreateEvent | `ref_type == repository` | Repo |
  | PublicEvent | all | Repo |

  Every other type is dropped and logged to the console.
- Push cards fetch `GET /repos/{owner}/{repo}/compare/{before}...{head}` lazily when within two cards of the viewport, cached per push id. Until it loads the card shows the ref and short sha.

### Feed building ([Feed order and same-repo collapse](issues/06-feed-order.md))

- Both Sources merge into one list, newest first. Events sort by `created_at`, starred releases by `publishedAt`. No ranking.
- Collapse rules build Groups:
  - Pushes: same repo, same actor, same ref, within 6 hours, merge into one Change card placed at the newest push, showing "N pushes to {ref}" and the commit list from one compare request spanning the oldest `before` to the newest `head`.
  - Stars and forks: same repo, same type, within 24 hours, merge into one Repo card that lists the actors.
  - Releases dedupe by release id across Sources.
- A Card's id is the newest event id in its Group. A new event joining a Group changes the id, so the Card counts as unseen again.
- The feed builder is a pure function: raw events, starred repos, seen ids, and a clock in; ordered Cards plus the End card out.

### Seen state ([Seen state and resume position](issues/07-seen-state.md))

- Seen when swiped past (card leaves the viewport upward) or fully in view for 1 second, whichever comes first.
- Seen ids in localStorage under one key, pruned to the 30-day window, capped at 1000, oldest dropped first.
- Seen cards are hidden. The feed always starts at the top. "Mark all unseen" clears the set.

### Card layout ([Card layout prototype](issues/09-card-prototype.md), variant J)

- Background: the actor's avatar at 400 px, scaled to 140 %, blurred 60 px, saturated, 45 % opacity over black.
- Top: event type label in 44 px bold, then a stats row of stars, forks, open issues in 26 px with 13 px captions, plus a language dot in the language colour. Gear icon (44 px target) top-right. All padded by the top safe-area inset.
- Bottom-left: actor line (36 px avatar, "alice, bob +1 starred", relative time), repo in 30 px with owner and name on two lines, title in 19 px, a bulleted body capped at 40 dvh, a dim meta line. Padded by the bottom safe-area inset.
- Bottom-right rail: two 56 px round buttons, Star (gold when on) and Open.
- All text wraps with `overflow-wrap: anywhere`. No horizontal scroll. Every tap target at least 44 px.
- Repo stats for received-event cards come from one aliased GraphQL query per 50 repos, fetched before the first swipe.

### Shell ([App shell: states and gestures](issues/11-app-shell.md), [Research: iOS standalone PWA quirks](issues/04-ios-pwa-quirks.md), [Scaffold the app shell](issues/08-scaffold-app.md))

- Vite + React + TypeScript, bun as package manager and runner, vite-plugin-pwa with `registerType: 'autoUpdate'`. Manifest: `display: standalone` (never `fullscreen`), `id` and `start_url` of `/`, 192 and 512 icons plus a maskable one. Apple meta tags kept as fallback. `viewport-fit=cover`.
- Feed container: `100dvh` in the browser, `100vh` under `display-mode: standalone`, `scroll-snap-type: y mandatory`, `scroll-snap-stop: always` on cards, `overscroll-behavior: none`. Body is fixed and hidden. Overlays use `position: absolute`, never `fixed`. Card detection via `scrollend` with a scroll-plus-timer fallback.
- On open: render the cached feed, then fetch page 1 of each Source and rebuild, then page the rest in the background. Empty cache shows one skeleton card.
- End card at the end of the feed: "caught up" with last-checked time and Refresh. The same shape carries errors: token rejected or missing scope (button to settings), rate limited (Retry, reset time), offline with no cache (Retry). Offline with cache shows a small chip top-left, no card.
- Refresh on `visibilitychange` to visible and on the Refresh button, throttled to once per 60 s. No polling while open. No custom pull-to-refresh.
- New cards found mid-session show a "N new" pill at the top; tap scrolls to the top. No silent insert.
- One-time dismissible install hint when `navigator.standalone === false` on iOS Safari, dismissal in localStorage.
- Same single-card layout in landscape.

### Settings and token ([Settings screen and star action](issues/12-settings-and-star.md), [Task: verify token access with a real PAT](issues/10-verify-token-access.md), [Research: PAT scopes](issues/02-pat-scopes.md))

- Full-screen `/settings` route in normal document flow with a back button. Not a sheet.
- Contents: password-type token input with `autocomplete="off"`, a "Create token" link to GitHub's new-token page pre-filled with `scopes=public_repo` and a description, Save, login and avatar from `GET /user`, "Mark all unseen", "Sign out", version string, repo link.
- Token kind: classic with `public_repo`, verified end to end. Fine-grained is mentioned as an alternative (Starring read and write plus public repository access), star write unverified.
- Token in localStorage as a plain string. First run with no token opens settings.
- 401 anywhere clears the feed and shows the "token rejected" End card. 403 with an accepted-scopes header shows "needs public_repo". The stored token stays until replaced.

### Star action ([Settings screen and star action](issues/12-settings-and-star.md))

- Star state from the starred GraphQL query already fetched on open, checked locally by `nameWithOwner`. No per-card request.
- Tap toggles at once and sends `PUT` or `DELETE /user/starred/{owner}/{repo}`. On failure, revert and show a toast. A repo starred from a card joins the starred Source on the next fetch.

### Fetch plan and storage ([Fetch plan for both sources](issues/13-fetch-plan.md))

- Events: up to 3 pages of 100 with a stored ETag per URL. A 304 costs nothing with the Authorization header. Obey `X-Poll-Interval`, default 60 s.
- Starred: pages of 100 up to 1000 repos. Note in settings when the cap or `isOverLimit` cut the list.
- Rate-limit floor: under 100 remaining, stop background paging and lazy fetches.
- The built feed (cards, stats, compare results, ETags) lives in localStorage under one key. The service worker precaches the app shell only, plus workbox `CacheFirst` for `avatars.githubusercontent.com` (7 days, 200 entries). No API responses in the service worker cache.
- Every request sends `X-GitHub-Api-Version: 2022-11-28` and the Authorization header.

### Hosting

- Static build on GitHub Pages under the project repo. Any static host works.

## Testing Decisions

A good test feeds fixtures in at a seam and asserts on what comes out. It never touches the DOM, never calls a real host, and never reaches into internals.

Two seams:

1. **Feed builder** (primary). Pure function, fixtures of raw events and starred repos in, ordered Cards out. Tests cover: type filtering and the PR and issue action filters; push collapse across the 6-hour window with other events interleaved; star and fork collapse across 24 hours; release dedupe across Sources; hide-seen and the End card; sort order across both Sources; Card id equals the newest event id in a Group; an unknown type is dropped. Fixtures are trimmed copies of the shapes in the Events API docs.
2. **GitHub client** (secondary). Takes an injected `fetch`. Tests pass a fake that returns fixture bodies and headers. Cover: paging until no `next` link; ETag sent and 304 reuses the cached page; starred paging stops at the cap; the rate-limit floor stops optional fetches; 401 and 403 map to the right End card cause; aliased stats query batches 50 repos.

No component or end-to-end tests. Layout, snap, safe areas, keyboard, large text, and standalone mode are checked on an iPhone by hand, following the mobile-adapt checklist.

Runner: bun's built-in test runner. No new test dependency. No prior art in the repo; this is the first code.

## Out of Scope

- GitHub OAuth login. Needs a backend or worker.
- Notifications API as a Source.
- The user's own activity (`GET /users/{me}/events`) as a Source.
- Comments, replies, or any write action other than star.
- Private repos. Both token kinds return 404 for them with the chosen scope.
- Multiple GitHub accounts.
- A native app.
- Post-v1: Android and Chromium polish, repo-aggregated cards, follow, share, and save actions, a "show seen" toggle.

## Further Notes

- The Events API lags 30 seconds to 6 hours. The feed is not real-time and the UI must not pretend otherwise.
- `PushEvent` carries no commit list. The compare request is the only way to show commits.
- `latestRelease` behaviour for prereleases is unverified. Query `releases(first: 1)` alongside and compare when a prerelease shows up, then keep one.
- The prototype in `src/PrototypeFeed.tsx` and the prototype block at the end of `src/index.css` are throwaway. Move them to a `prototype/card-layout` branch and replace them with the real Feed. The scaffold (`index.html`, `vite.config.ts`, the shell CSS above the prototype block) stays.
- The installed Home Screen app starts with empty storage. The token must be entered again after install. Accepted.
- Never hardcode a phone viewport size. Test at 375, 390, and 430 CSS px wide.
- Research notes with sources live in `.scratch/gittok/research/`.
