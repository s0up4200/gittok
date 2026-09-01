# Task: verify token access with a real PAT

Type: task
Status: resolved
Blocked by: 

## Question

Three facts from the research are unverified without a real token. Create one classic PAT with `public_repo` and one fine-grained PAT with Starring read+write, then run against the API with `curl` from the shell (never from a test):

1. Does the fine-grained token read `GET /users/{me}/received_events`? Record the status and `X-Accepted-GitHub-Permissions` if it fails.
2. Does the fine-grained token run the `viewer.starredRepositories` GraphQL query, and does `latestRelease` skip prereleases?
3. What is `isOverLimit` for your own star count?

Record the results, then revoke both tokens. The answer decides which token kind the token-entry screen asks for.

## Answer

Run on 2026-09-01 with a curl script (deleted after use), one fine-grained token (Public repositories, Starring permission) and one classic token (`public_repo`). Both revoked after.

| Check | Fine-grained | Classic `public_repo` |
|---|---|---|
| `GET /users/{me}/received_events` | 200, `allows_permissionless_access=true` | 200 |
| `GET /user/starred` | 200, needs `starring=read` | 200 |
| GraphQL `viewer.starredRepositories` with `latestRelease` | 200 | 200 |
| `GET /user/starred/{o}/{r}` on a public repo | 204 | 204 |
| `PUT` / `DELETE /user/starred/{o}/{r}` on a public repo | 403, needs `starring=write` | 204 / 204 |
| Any call on a private repo | 404 | 404, accepted scope `repo` |

Facts:

- `isOverLimit` was false at 436 starred repos. Threshold still unknown, above 436.
- `latestRelease` returned null for repos with no release and a non-prerelease tag where one existed. No prerelease in the sample, so whether it skips prereleases is still unverified. Query `releases(first: 1)` alongside and compare when one shows up.
- The fine-grained token's star write failed with 403. The token most likely had Starring at read-only; the header names `starring=write` as the missing permission. Not retested.
- Rate limit: 5000 per hour on both, every call cost 1 point, GraphQL included.

Decision: the settings screen asks for a **classic token with `public_repo`**. That is one scope, verified end to end. Mention fine-grained as an alternative with "Starring: read and write" plus public repository access, unverified for the write. Private-repo events and stars need `repo` and are out of scope.

Side effect: the classic run unstarred `s0up4200/omarchy-qui`. Re-star it by hand if wanted.
