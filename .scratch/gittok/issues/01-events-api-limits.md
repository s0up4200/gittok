# Research: Events API limits and polling

Type: research
Status: resolved
Blocked by: 

## Question

What are the hard limits of `GET /users/{username}/received_events`? Cover: page size and the maximum number of pages, the 90-day and 300-event caps, the delay before new events appear, ETag and `X-Poll-Interval` behaviour for conditional requests, rate-limit cost of conditional 304 responses, and which event types the endpoint can return with their payload shapes. Cite GitHub REST docs. Write findings to `.scratch/gittok/research/events-api-limits.md`.

## Answer

Full findings: `.scratch/gittok/research/events-api-limits.md` (every claim has a docs.github.com URL).

- The window is 30 days, not 90. The timeline also caps at 300 events. Both apply together.
- `per_page` max is 100, default 30. No page cap is documented; the 300-event cap gives 3 pages at 100.
- New events take 30 seconds to 6 hours to appear. GitHub says the API is not for real-time use.
- Save the `ETag`, send it in `If-None-Match`. A `304` costs zero rate limit only when the request has an `Authorization` header.
- Obey `X-Poll-Interval` (seconds). The docs example is 60. Use the same query parameters each poll or the ETag changes.
- 16 event types are documented. `PushEvent` payload is only `repository_id`, `push_id`, `ref`, `head`, `before`. No commit list.
- The event `id` is a string in the example JSON, an integer in the docs table. Parse it as a string.
