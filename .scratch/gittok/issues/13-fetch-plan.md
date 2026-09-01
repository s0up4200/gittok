# Fetch plan for both sources

Type: grilling
Status: resolved
Blocked by: 

## Question

How and when the app fetches. Decide: on open, fetch `received_events` (3 pages of 100 with ETag) and the starred-releases GraphQL query (100 repos per page), or only the first page and the rest as the user swipes; the poll cadence while the app is open (`X-Poll-Interval`, at least 60 s) and on return from background; the cap on starred repos before the app stops paging (`isOverLimit`); the per-repo stats fetch for cards from `received_events` (one `GET /repos/{o}/{r}` per repo, cached how long); and what the service worker caches so the app opens offline with the last feed.

## Answer

On open:

1. Read the last built feed from localStorage and render it.
2. Fetch page 1 of `received_events` (`per_page=100`, with the stored ETag) and page 1 of the starred GraphQL query (`viewer.starredRepositories(first: 100, orderBy: {field: STARRED_AT, direction: DESC})` with `latestRelease`, `stargazerCount`, `forkCount`, `issues(states: OPEN) { totalCount }`, `primaryLanguage`, `viewerHasStarred`). Rebuild and render.
3. Fetch the remaining pages in the background: up to 2 more event pages, and starred pages up to a cap of 1000 repos (10 pages). Append as they land. Show a note in settings when the cap or `isOverLimit` cuts the list.
4. For repos that appear in received events and are not in the starred set, fetch stats in one GraphQL query per 50 repos using aliases, before the first swipe.

Refresh: no polling while open. Refetch on `visibilitychange` to visible and on the Refresh button, throttled to once per 60 s. Same fetch sequence as on open.

Lazy fetches: push cards fetch `compare/{before}...{head}` when within 2 cards of the viewport, cached per `push_id` in the feed blob.

Rate limit: when `x-ratelimit-remaining` drops under 100, stop background paging and lazy fetches. Show the rate-limited end card only when a required fetch fails with 403 and remaining 0.

Storage: the built feed (cards, stats, compare results, ETags) in localStorage under one key. Service worker precaches the app shell (vite-plugin-pwa default). Workbox runtime caching for `avatars.githubusercontent.com` only: `CacheFirst`, 7 days, 200 entries. No API responses cached in the service worker.
