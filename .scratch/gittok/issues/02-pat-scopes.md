# Research: PAT scopes for feed, starred list, and starring

Type: research
Status: resolved
Blocked by: 

## Question

Which personal access token scopes does GitTok need to read `received_events`, list the user's starred repos, and star a repo? Compare classic tokens and fine-grained tokens: can a fine-grained token read received events and star repos at all? Record the minimum scope set for each token kind, and what the API returns when a scope is missing. Cite GitHub docs. Write findings to `.scratch/gittok/research/pat-scopes.md`.

## Answer

Full findings with a source per claim: `.scratch/gittok/research/pat-scopes.md`.

- Classic PAT: `public_repo` is the minimum. It is "required for starring public repositories" and also covers the feed and the starred list for public repos. No scope at all reads public feed events and public starred repos. Use `repo` only to see private-repo events or star private repos.
- Fine-grained PAT: set the "Starring" account permission to read and write. Keep the default "Public repositories" access; it supplies the "Metadata" read that `PUT /user/starred/{owner}/{repo}` needs. Resource owner must be the user, not an org.
- Fine-grained PATs can read `received_events`. The endpoint page says it works with fine-grained PATs and "does not require any permissions". The two summary pages omit it, so verify with a real token.
- Missing scope or permission returns `403 Forbidden` or `404 Not Found`. Bad token returns `401`. Read `X-Accepted-OAuth-Scopes` (classic) or `X-Accepted-GitHub-Permissions` (fine-grained) on the error to see what is required.
- Feed limits: at most 300 events, at most 30 days old, latency 30s to 6h. Poll with `ETag` and obey `X-Poll-Interval`.
