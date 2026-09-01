# PAT scopes for feed, starred list, and starring

Date: 2026-09-01
Ticket: `.scratch/gittok/issues/02-pat-scopes.md`
Sources: docs.github.com only. No API calls were made.

## Summary

| Task | Endpoint | Classic PAT scope | Fine-grained PAT permission |
|---|---|---|---|
| Read feed | `GET /users/{username}/received_events` | none for public events; `repo` to see private-repo events (inference, see A3) | none required; works with fine-grained PATs |
| List starred repos | `GET /user/starred` | none for public repos (inference, see B3) | "Starring" user permission (read) |
| Star a repo | `PUT /user/starred/{owner}/{repo}` | `public_repo` (public repos); `repo` covers private repos | "Starring" user permission (write) + "Metadata" repository permission (read) |

Minimum sets:

- Classic PAT: `public_repo`. This covers all three tasks for public repositories. Use `repo` only if the feed must show private-repo events or the user stars private repos.
- Fine-grained PAT: "Starring" account permission set to read and write. Keep the default "Public repositories" repository access. No other permission is needed.

## A. Feed: `GET /users/{username}/received_events`

A1. Description. "These are events that you've received by watching repositories and following users. If you are authenticated as the given user, you will see private events. Otherwise, you'll only see public events."
Source: https://docs.github.com/en/rest/activity/events#list-events-received-by-the-authenticated-user

A2. Fine-grained tokens. "This endpoint works with the following fine-grained token types: GitHub App user access tokens, GitHub App installation access tokens, Fine-grained personal access tokens. The fine-grained token does not require any permissions."
Source: https://docs.github.com/en/rest/activity/events#list-events-received-by-the-authenticated-user

A3. Classic token scope. The endpoint page lists no scope. The OAuth scopes page says a token with "(no scope)" "Grants read-only access to public information (including user profile info, repository info, and gists)". Private events come from private repositories. The `repo` scope "Grants full access to public and private repositories". Inference: no scope is needed for public events; `repo` is needed to see events from private repositories. The docs do not state this directly.
Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes

A4. Status codes. The endpoint lists only `200 OK`.
Source: https://docs.github.com/en/rest/activity/events#list-events-received-by-the-authenticated-user

A5. Limits. "The timeline will include up to 300 events. Only events created within the past 30 days will be included. Events older than 30 days will not be included (even if the total number of events in the timeline is less than 300)."
Source: https://docs.github.com/en/rest/activity/events

A6. Polling. "Events are optimized for polling with the "ETag" header. If no new events have been triggered, you will see a "304 Not Modified" response, and your current rate limit will be untouched. There is also an "X-Poll-Interval" header that specifies how often (in seconds) you are allowed to poll."
Source: https://docs.github.com/en/rest/activity/events

A7. Latency. "This API is not built to serve real-time use cases. Depending on the time of day, event latency can be anywhere from 30s to 6h."
Source: https://docs.github.com/en/rest/activity/events

A8. Two docs pages disagree on listing. The page "Endpoints available for fine-grained personal access tokens" does not list `/users/{username}/received_events`, `/users/{username}/events`, or `/events`. The page "Permissions required for fine-grained personal access tokens" has no "User permissions for Events" section; its only Events section is an organization permission for `GET /users/{username}/events/orgs/{org}`. But the endpoint reference page (A2) says the endpoint works with fine-grained PATs and needs no permission. The endpoint reference page is the more specific source. Trust A2.
Sources:
- https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens
- https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens#organization-permissions-for-events

A9. There is an account permission named "Events" (`user_events`, read) in the fine-grained PAT permission table. The docs do not link it to any REST endpoint. Do not rely on it. If private events are missing from the feed with a fine-grained PAT, try this permission and record the result.
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#account-permissions

## B. Starred list: `GET /user/starred`

B1. Description. "Lists repositories the authenticated user has starred."
Source: https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user

B2. Fine-grained tokens. "This endpoint works with the following fine-grained token types: GitHub App user access tokens, Fine-grained personal access tokens. The fine-grained token must have the following permission set: "Starring" user permissions (read). This endpoint can be used without authentication or the aforementioned permissions if only public resources are requested."
Source: https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user

B3. Classic token scope. The endpoint page lists no scope. "(no scope)" grants read-only access to public information (see A3). Inference: no scope is needed to list starred public repos. Starred private repos need `repo`.
Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes

B4. Status codes. `200 OK`, `304 Not modified`, `401 Requires authentication`, `403 Forbidden`.
Source: https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user

B5. Star timestamp. The media type `application/vnd.github.star+json` "Includes a timestamp of when the star was created."
Source: https://docs.github.com/en/rest/activity/starring

## C. Star a repo: `PUT /user/starred/{owner}/{repo}`

C1. Classic token scope. The `public_repo` scope "Limits access to public repositories. That includes read/write access to code, commit statuses, repository projects, collaborators, and deployment statuses for public repositories and organizations. Also required for starring public repositories." The `repo` scope includes `public_repo`.
Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes

C2. Fine-grained tokens. "This endpoint works with the following fine-grained token types: GitHub App user access tokens, Fine-grained personal access tokens. The fine-grained token must have the following permission set: "Starring" user permissions (write) and "Metadata" repository permissions (read)."
Source: https://docs.github.com/en/rest/activity/starring#star-a-repository-for-the-authenticated-user

C3. Metadata on public repos. "Tokens always include read-only access to all public repositories on GitHub." So the default "Public repositories" repository access supplies the Metadata read permission for any public repo. To star a private repo, the token must have repository access to that repo.
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token

C4. Account permission constraint. "Account permissions can only be used when the current user is the resource owner." Set the resource owner to the user, not an organization.
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#account-permissions

C5. Request detail. "Note that you'll need to set Content-Length to zero when calling out to this endpoint."
Source: https://docs.github.com/en/rest/activity/starring#star-a-repository-for-the-authenticated-user

C6. Status codes. `204 No Content`, `304 Not modified`, `401 Requires authentication`, `403 Forbidden`, `404 Resource not found`.
Source: https://docs.github.com/en/rest/activity/starring#star-a-repository-for-the-authenticated-user

C7. Unstar. `DELETE /user/starred/{owner}/{repo}` has the same permission set and status codes as C2 and C6.
Source: https://docs.github.com/en/rest/activity/starring#unstar-a-repository-for-the-authenticated-user

C8. Check star state. `GET /user/starred/{owner}/{repo}` needs "Metadata" repository permissions (read) and "Starring" user permissions (read). Returns `204` if starred, `404` if not.
Source: https://docs.github.com/en/rest/activity/starring#check-if-a-repository-is-starred-by-the-authenticated-user

## D. What the API returns when a scope or permission is missing

D1. General rule. A request with a token that has "insufficient permissions, you will receive a 404 Not Found or 403 Forbidden response. Authenticating with invalid credentials will initially return a 401 Unauthorized response."
Source: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api#about-authentication

D2. Classic tokens. Two response headers show the scope state. "X-OAuth-Scopes lists the scopes your token has authorized. X-Accepted-OAuth-Scopes lists the scopes that the action checks for." Read these headers on a `403` to find the missing scope.
Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#requested-scopes-and-granted-scopes

D3. Fine-grained tokens. "The value of the X-Accepted-GitHub-Permissions header is a comma separated list of the permissions that are required to use the endpoint." Example: `X-Accepted-GitHub-Permissions: contents=read`.
Source: https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#resource-not-accessible

D4. Classic PAT with no scopes. "A token with no assigned scopes can only access public information."
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic

## E. Classic versus fine-grained

E1. GitHub recommends fine-grained. "GitHub recommends that you use fine-grained personal access tokens instead of personal access tokens (classic) whenever possible." But "Fine-grained personal access tokens ... cannot accomplish every task that a personal access token (classic) can."
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#types-of-personal-access-tokens

E2. Classic tokens use OAuth scopes. "If you are using a personal access token (classic), it requires specific scopes in order to access each REST API endpoint."
Source: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api#authenticating-with-a-personal-access-token

E3. Listed fine-grained gaps. None of the gaps touches starring or events. The gaps are: contributing to public repos where the user is not a member, contributing as an outside collaborator, multiple organizations at once, Packages, the Checks API, and user-owned Projects.
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens

## F. Open points

F1. The classic scope for private events in `received_events` (A3) and for private starred repos (B3) is an inference from the "(no scope)" and `repo` descriptions. The endpoint pages do not name a scope.

F2. The `user_events` account permission (A9) has no documented endpoint. The events endpoint says no permission is needed. Verify with a real fine-grained PAT that private events appear without it.

F3. Fine-grained PAT support for `received_events` is documented on the endpoint page but not on the two summary pages (A8). Verify with a real token before release.
