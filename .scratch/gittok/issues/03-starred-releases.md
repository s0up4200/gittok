# Research: cheapest way to fetch releases for N starred repos

Type: research
Status: resolved
Blocked by: 

## Question

The user may star hundreds of repos. Find the cheapest way, in requests and rate-limit points, to get recent releases across all starred repos from a browser with a PAT. Compare REST (`/user/starred` then `/repos/{o}/{r}/releases/latest` per repo), REST `/repos/{o}/{r}/events` filtered to ReleaseEvent, and one GraphQL query over `viewer.starredRepositories` with `releases(last: 1)`. Record page sizes, rate-limit point costs, CORS support for the GraphQL endpoint, and whether `received_events` already includes ReleaseEvent for starred repos you do not follow. Cite GitHub docs. Write findings to `.scratch/gittok/research/starred-releases.md`.

## Answer

Use one GraphQL query: `viewer.starredRepositories(first: 100)` with `latestRelease` and `releases(first: 1, orderBy CREATED_AT DESC)` per repo.
Cost: 1 point per page of 100 repos (101 connection requests / 100 rounds to 1). 300 starred repos = 3 sequential requests, 3 of 5,000 GraphQL points per open.
REST `/user/starred` + `/releases/latest` per repo = 303 requests and 303 core points per open. ETag 304s are free on repeat opens but still 303 round trips.
REST `/repos/{o}/{r}/events` is the same 303+ requests, only 30 days and 300 events deep, and releases hide behind other events.
`received_events` covers watched repos and followed users only. Starring is not watching, so it misses starred repos.
CORS: docs cover REST only, but a credential-free preflight on `/graphql` returned `Access-Control-Allow-Origin: *` with `Authorization` allowed. A browser can call it.
Watch `StarredRepositoryConnection.isOverLimit`; GitHub truncates the star list for users with many stars, threshold undocumented.
Untested with a real token: `isOverLimit` threshold, whether `latestRelease` skips prereleases, and the fine-grained PAT permission GraphQL needs.
Full findings with sources: `.scratch/gittok/research/starred-releases.md`.
