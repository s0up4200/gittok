# Cheapest way to fetch releases for N starred repos

Date: 2026-09-01. Ticket: `.scratch/gittok/issues/03-starred-releases.md`.
Context: browser client, personal access token (PAT), hundreds of starred repos.
All api.github.com probes below ran without a credential.

## 1. Limits that apply to every approach

- Authenticated REST requests count against "your personal rate limit of 5,000 requests per hour". [rest-rate]
- "The GraphQL API also has a separate primary rate limit." [rest-rate] It is "5,000 points per hour per user". [gql-rate]
- `GET /rate_limit` reports `core` (REST) and `graphql` as separate resources. "Accessing this endpoint does not count against your REST API rate limit." [rate-endpoint]
- Secondary limit, shared by REST and GraphQL: "No more than 100 concurrent requests are allowed." "No more than 900 points per minute are allowed for REST API endpoints, and no more than 2,000 points per minute are allowed for the GraphQL API." REST `GET` = 1 point. GraphQL query without mutations = 1 point. [rest-rate]
- GitHub says to "make requests serially instead of concurrently" to avoid the secondary limit. [rest-best]
- Conditional requests: "Making a conditional request does not count against your primary rate limit if a `304` response is returned." This applies to REST endpoints that return `etag` or `last-modified`. [rest-best] The GraphQL docs do not describe conditional requests.
- CORS, REST: "The REST API supports cross-origin resource sharing (CORS) for AJAX requests from any origin." `Access-Control-Allow-Origin: *`. `Authorization`, `If-None-Match` and `Content-Type` are in the allowed request headers. [cors]

## 2. Approach A: REST `/user/starred` then `/releases/latest` per repo

- `GET /user/starred`: `per_page` default 30, maximum 100. `sort` is `created` (time of star) or `updated`. Accept `application/vnd.github.star+json` adds `starred_at`. [starring]
- Fine-grained PAT: `GET /user/starred` needs user permission "Starring" (read). [fg-perms]
- `GET /repos/{owner}/{repo}/releases/latest`: "the most recent non-prerelease, non-draft release, sorted by the created_at attribute." "The created_at attribute is the date of the commit used for the release, and not the date when the release was drafted or published." [releases]
- `GET /repos/{owner}/{repo}/releases`: `per_page` default 30, maximum 100. Returns published releases to everyone; drafts only with push access. [releases]
- Fine-grained PAT: both releases endpoints need repository permission "Contents" (read). [fg-perms]

Cost for 300 starred repos, one open:
- 3 requests for the star list (100 per page).
- 300 requests for `releases/latest` (or `releases?per_page=1`).
- Total 303 requests, 303 `core` points, 303 secondary points. About 16 opens per hour before the 5,000 limit.
- With ETags: a repeat open still sends 303 requests, but each `304` costs 0 `core` points. [rest-best] The secondary limit still counts each request. The 100-concurrent cap means the client must queue.
- `releases/latest` hides prereleases. Use `releases?per_page=1` to see them.

## 3. Approach B: REST `/repos/{owner}/{repo}/events` filtered to `ReleaseEvent`

- Events API: "The timeline will include up to 300 events. Only events created within the past 30 days will be included." [events]
- `ReleaseEvent`: "Activity related to a release." `action` "Can be `published`." Payload carries the release object. [event-types]
- `GET /repos/{owner}/{repo}/events`: `per_page` default 30, maximum 100. Fine-grained PAT needs "Metadata" (read). [events] [fg-perms]
- ETag polling: a `304 Not Modified` does not consume the rate limit. `X-Poll-Interval` tells the client how often it may poll: "Please obey the header." [events]

Cost for 300 starred repos, one open:
- 3 + 300 = 303 requests minimum, same as approach A.
- Worse than A: a busy repo pushes `ReleaseEvent` out of its first page, so some repos need more pages. Releases older than 30 days are invisible. The `release` payload comes with the event, so no extra request per release.

## 4. Approach C: `received_events`

- `GET /users/{username}/received_events`: "These are events that you've received by watching repositories and following users." [events]
- Same window: 300 events, 30 days. [events]
- Starring and watching are different features. Starring "makes it easy to find a repository or topic again later" and "shows appreciation". [stars] Watching is a notification subscription; the Custom watch option lets you pick "releases". [watch]
- The event-types page does not say that any starred-repo event reaches `received_events`. [event-types]

Result: `received_events` does not cover starred repos that the user does not watch. It cannot answer the question. It would cost 1 to 3 requests, but the data is wrong.

## 5. Approach D: one GraphQL query over `viewer.starredRepositories`

Endpoint: `POST https://api.github.com/graphql`, header `Authorization: bearer TOKEN`. "All fine-grained personal access tokens include read access to public repositories." [gql-calls]

Schema (official download, `schema.docs.graphql`) [schema]:
- `User.starredRepositories(after, before, first, last, orderBy: StarOrder, ownedByViewer)` returns `StarredRepositoryConnection`.
- `StarOrderField` has one value: `STARRED_AT`.
- `StarredRepositoryEdge.starredAt: DateTime!`.
- `StarredRepositoryConnection.isOverLimit: Boolean!` — "Is the list of stars for this user truncated? This is true for users that have many stars." The threshold is not documented.
- `Repository.latestRelease: Release` — "Get the latest release for the repository if one exists." The schema does not say whether prereleases count.
- `Repository.releases(after, before, first, last, orderBy: ReleaseOrder)` returns `ReleaseConnection`. `ReleaseOrderField` is `CREATED_AT` or `NAME`.
- `Release` fields: `name`, `tagName`, `publishedAt`, `createdAt`, `isPrerelease`, `isDraft`, `isLatest`, `url`, `description`.

Query shape:

```graphql
query($after: String) {
  viewer {
    starredRepositories(first: 100, after: $after,
                        orderBy: {field: STARRED_AT, direction: DESC}) {
      isOverLimit
      pageInfo { hasNextPage endCursor }
      edges {
        starredAt
        node {
          nameWithOwner
          latestRelease { tagName name publishedAt url isPrerelease }
          releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes { tagName name publishedAt url isPrerelease isDraft }
          }
        }
      }
    }
  }
  rateLimit { cost remaining resetAt }
}
```

Limits and cost:
- "Clients must supply a `first` or `last` argument on any connection." "Values of `first` and `last` must be within 1-100." "Individual calls cannot request more than 500,000 total nodes." [gql-rate]
- Point cost: "Add up the number of requests needed to fulfill each unique connection", then "Divide the number by 100 and round the result to the nearest whole number." "The minimum point value of a call to the GraphQL API is 1." [gql-rate]
- This query: 1 request for `starredRepositories` + 100 for `releases` = 101. 101 / 100 rounds to 1 point per page. `latestRelease` is not a connection, so it adds 0.
- Nodes per page: 100 repos + 100 releases = 200. Far under 500,000.
- For 300 starred repos: 3 sequential requests (the cursor comes from the previous page), 3 points of 5,000 per hour, 3 secondary points. Over 1,600 opens per hour.
- The `rateLimit` field returns `limit`, `cost`, `remaining`, `resetAt`, `used` for free. [gql-rate]
- No documented ETag support. Every open pays 1 point per page.
- Use both `latestRelease` and `releases(first: 1)`. The first matches the REST "latest" semantics. The second shows a newer prerelease. `isPrerelease` tells them apart.
- Check `isOverLimit`. If it is `true`, the list is truncated and the client must tell the user.

CORS for `/graphql`: the GitHub CORS page covers only the REST API. [cors] A credential-free browser-style preflight on 2026-09-01 returned:

```
OPTIONS https://api.github.com/graphql  (Origin: https://example.invalid)
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, POST, PATCH, PUT, DELETE
access-control-allow-headers: Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, ... X-GitHub-Api-Version, ...
access-control-expose-headers: ETag, Link, ... X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, ...
access-control-max-age: 86400
```

An unauthenticated `POST /graphql` with an `Origin` header also returned `access-control-allow-origin: *` and `x-ratelimit-resource: graphql`. The headers are identical to those on `/user/starred`. A browser can call GraphQL with a PAT.

## 6. Recommendation

| Approach | Requests per open (300 starred) | Rate-limit cost per open | Verdict |
|---|---|---|---|
| D. GraphQL `viewer.starredRepositories` + `releases(first:1)` + `latestRelease` | 3 (sequential, 100 repos each) | 3 of 5,000 `graphql` points | Use this. |
| A. REST `/user/starred` + `/releases/latest` per repo | 303 | 303 of 5,000 `core` points; 304s are free on repeat opens but still 303 round trips | Fallback only. |
| B. REST `/repos/{o}/{r}/events` filtered to `ReleaseEvent` | 303 or more | 303+ `core` points | No. 30-day window, releases hidden behind other events. |
| C. REST `received_events` | 1 to 3 | 1 to 3 `core` points | No. Covers watched repos and followed users, not stars. |

Open points to test with a real token (not done here):
- The star count at which `isOverLimit` becomes `true`.
- Whether `latestRelease` excludes prereleases like REST `/releases/latest` does.
- The fine-grained PAT permission that `viewer.starredRepositories` needs. REST needs "Starring" (read); GraphQL is not documented.

## Sources

- [rest-rate] https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- [rest-best] https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- [rate-endpoint] https://docs.github.com/en/rest/rate-limit/rate-limit
- [cors] https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests
- [starring] https://docs.github.com/en/rest/activity/starring
- [releases] https://docs.github.com/en/rest/releases/releases
- [events] https://docs.github.com/en/rest/activity/events
- [event-types] https://docs.github.com/en/rest/using-the-rest-api/github-event-types
- [fg-perms] https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- [stars] https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars
- [watch] https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications
- [gql-rate] https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
- [gql-calls] https://docs.github.com/en/graphql/guides/forming-calls-with-graphql
- [gql-paging] https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api
- [schema] https://docs.github.com/public/fpt/schema.docs.graphql (official public schema download)
- CORS probe: credential-free `curl -X OPTIONS` and `curl -X POST` against `https://api.github.com/graphql`, 2026-09-01.
