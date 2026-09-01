# Which event types become cards

Type: grilling
Status: resolved
Blocked by: 01

## Question

Of the event types `received_events` returns, which become a card, which are dropped, and does any type need a different card shape? Starting gut: keep Release, Push, Watch (star), Fork, PullRequest opened and merged, Create (repo). Drop IssueComment, Delete, Member, Public, Gollum.

## Answer

Kept types and the card shape each one uses:

| Type | Filter | Card shape |
|---|---|---|
| `ReleaseEvent` | all (`published`) | Release |
| `PushEvent` | all | Change |
| `PullRequestEvent` | `opened`, or `closed` with `pull_request.merged == true` | Change |
| `IssuesEvent` | `opened` only | Change |
| `WatchEvent` | all (a star) | Repo |
| `ForkEvent` | all | Repo |
| `CreateEvent` | `ref_type == repository` only | Repo |
| `PublicEvent` | all | Repo |

Dropped: `CommitCommentEvent`, `DeleteEvent`, `DiscussionEvent`, `GollumEvent`, `IssueCommentEvent`, `MemberEvent`, `PullRequestReviewEvent`, `PullRequestReviewCommentEvent`. Any type not in the kept table is dropped and logged to the console.

Three card shapes:

- **Repo card**: repo description, star count, language. For Watch, Fork, Create, Public.
- **Change card**: title or commit list, body excerpt. For Push, PullRequest, Issues.
- **Release card**: tag, release notes excerpt. For Release events and for starred-repo releases from the GraphQL source.

Push cards: `PushEvent` carries no commits. When a push card nears the viewport, fetch `GET /repos/{owner}/{repo}/compare/{before}...{head}` once, cache by `push_id`, and show the commit messages. Until it loads, show the ref and short sha.

Sources stay at two: `received_events` (watched repos and followed users) and starred-repo releases. The user's own activity (`GET /users/{me}/events`) is not a source; ruled out of scope.
