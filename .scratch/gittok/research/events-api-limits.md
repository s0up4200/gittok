# Events API limits and polling

Ticket: `.scratch/gittok/issues/01-events-api-limits.md`
Date: 2026-09-01
Sources: docs.github.com only. No request was made to api.github.com.

Endpoint: `GET /users/{username}/received_events`.
Docs name: "List events received by the authenticated user".
Source: https://docs.github.com/en/rest/activity/events#list-events-received-by-the-authenticated-user

## Summary

- The window is 30 days, not 90 days. The ticket premise is wrong.
- The timeline holds at most 300 events.
- `per_page` max is 100. Default is 30. So at most 3 pages at `per_page=100`.
- New events can take 30 seconds to 6 hours to appear.
- Send `If-None-Match` with the saved `ETag`. A `304` costs zero rate limit when the request is authenticated.
- Obey `X-Poll-Interval` (seconds). The example value is 60.
- 16 event types are documented. `PushEvent` payload has no commit list.

## Page size and page count

| Fact | Value | Source |
|---|---|---|
| `per_page` maximum | 100 | [events][1]: "The number of results per page (max 100)." |
| `per_page` default for this endpoint | 30 | [events][1]: "Default: 30" |
| `page` default | 1 | [events][1] |
| Timeline cap | 300 events | [events][1]: "The timeline will include up to 300 events." |
| Over-size `per_page` | Clamped, no error | [pagination][4]: "the value is automatically reduced to the maximum" |

GitHub does not document a page-number cap for this endpoint. The 300-event cap sets it: 3 pages at `per_page=100`, 10 pages at the default 30.

Pagination uses the `link` header. Follow `rel="next"` until it is absent. Source: [pagination][4].

## Time window (30 days, not 90)

Exact text from [events][1]:

> The timeline will include up to 300 events. Only events created within the past 30 days will be included. Events older than 30 days will not be included (even if the total number of events in the timeline is less than 300).

Both caps apply together. A quiet feed can return fewer than 300 events.

## Delay before new events appear

Exact text from [events][1], in a note on each endpoint:

> This API is not built to serve real-time use cases. Depending on the time of day, event latency can be anywhere from 30s to 6h.

Do not design for a fixed delay. Plan for up to 6 hours.

## ETag and X-Poll-Interval

Exact text from [events][1]:

> Events are optimized for polling with the "ETag" header. If no new events have been triggered, you will see a "304 Not Modified" response, and your current rate limit will be untouched. There is also an "X-Poll-Interval" header that specifies how often (in seconds) you are allowed to poll. In times of high server load, the time may increase. Please obey the header.

The docs example shows `X-Poll-Interval: 60` on both the `200` and the `304` response. Source: [events][1].

The [best practices][3] page adds:

> If a response includes an x-poll-interval header, wait at least that many seconds before you poll the same endpoint again.

> Use the same parameters every time you poll the same data. A different page size, page number, or filter produces a different response with a different etag.

Procedure ([best practices][3]):

1. Send the request. Save the `etag` response header.
2. On the next request to the same URL, send the saved value in `If-None-Match`.
3. If the response is `304`, the data did not change.

Documented HTTP status codes for this endpoint: `200`, `304`, `403`, `503`. Source: [events][1].

## Rate-limit cost of a 304

Exact text from [best practices][3]:

> Making a conditional request does not count against your primary rate limit if a 304 response is returned and the request was made while correctly authorized with an Authorization header.

So a `304` is free only with an `Authorization` header. An unauthenticated `304` counts.

Primary limits ([rate limits][5]):

- Unauthenticated: 60 requests per hour.
- Personal access token: 5,000 requests per hour.

## Authentication and visibility

- "If you are authenticated as the given user, you will see private events. Otherwise, you'll only see public events." Source: [events][1].
- Fine-grained token types that work: GitHub App user access tokens, GitHub App installation access tokens, fine-grained personal access tokens. Source: [events][1].
- "The fine-grained token does not require any permissions." Source: [events][1].
- The docs curl example sends `X-GitHub-Api-Version: 2026-03-10`. Source: [events][1].

## Event types and payload shapes

Source for this whole section: [event types][2].

Common fields on every event:

| Field | Type | Note |
|---|---|---|
| `id` | integer in docs; string in the example JSON | "Unique identifier for the event." |
| `type` | string | PascalCase name. |
| `actor` | object | `id`, `login`, `display_login`, `gravatar_id`, `url`, `avatar_url` |
| `repo` | object | `id`, `name` (`owner/repo`), `url` |
| `payload` | object | Unique to the event type. |
| `public` | boolean | Visible to all users or not. |
| `created_at` | string | ISO 8601. |
| `org` | object, optional | `id`, `login`, `gravatar_id`, `url`, `avatar_url` |

Note: the docs table says `id` is an integer. The example response on [events][1] shows `"id": "22249084964"` as a string. Parse it as a string.

The 16 documented types:

| Type | Payload fields |
|---|---|
| `CommitCommentEvent` | `action` (`created`), `comment` |
| `CreateEvent` | `ref` (null when `ref_type` is `repository`), `ref_type` (`branch`, `tag`, `repository`), `full_ref`, `master_branch`, `description`, `pusher_type` (`user` or deploy key) |
| `DeleteEvent` | `ref`, `ref_type` (`branch`, `tag`), `full_ref`, `pusher_type` |
| `DiscussionEvent` | `action` (`created`), `discussion` |
| `ForkEvent` | `action` (`forked`), `forkee` (the new repository) |
| `GollumEvent` | `pages[]` with `page_name`, `title`, `summary` (nullable), `action` (`created`, `edited`), `sha`, `html_url` |
| `IssueCommentEvent` | `action` (`created`), `issue`, `comment` |
| `IssuesEvent` | `action` (`opened`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`), `issue`, optional `assignee`, `assignees`, `label`, `labels` |
| `MemberEvent` | `action` (`added`), `member` |
| `PublicEvent` | Empty payload |
| `PullRequestEvent` | `action` (`opened`, `closed`, `merged`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`), `number`, `pull_request`, optional `assignee`, `assignees`, `label`, `labels` |
| `PullRequestReviewEvent` | `action` (`created`, `updated`, `dismissed`), `pull_request`, `review` |
| `PullRequestReviewCommentEvent` | `action` (`created`), `pull_request`, `comment` |
| `PushEvent` | `repository_id`, `push_id`, `ref`, `head`, `before` |
| `ReleaseEvent` | `action` (`published`), `release` |
| `WatchEvent` | `action` (`started` only; a star) |

`PushEvent` has no `commits`, `size`, or `distinct_size` fields in the current docs. The example response on [events][1] agrees. A client that needs commit messages must fetch them with a separate request.

The event types page does not mark any type as deprecated or excluded.

## Design notes for gittok

- Store the `ETag` per URL, including query string. Poll with the same `per_page` and `page` every time.
- Sleep at least `X-Poll-Interval` seconds between polls of the same URL. Default to 60 when the header is absent.
- Always send `Authorization`, so `304` responses are free.
- One full sync is at most 3 requests at `per_page=100`. That is cheap against 5,000 per hour.
- Do not promise "live" updates. Latency can be hours.

[1]: https://docs.github.com/en/rest/activity/events
[2]: https://docs.github.com/en/rest/using-the-rest-api/github-event-types
[3]: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
[4]: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
[5]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
