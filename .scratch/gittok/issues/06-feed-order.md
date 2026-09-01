# Feed order and same-repo collapse

Type: grilling
Status: resolved
Blocked by: 05

## Question

Is the feed pure chronological, or ranked? If pushes from one repo are collapsed into one card, what is the collapse window and what does the collapsed card show? Does a collapsed card count as one event or many for seen-state? Starting gut: chronological, collapse consecutive pushes to the same repo by the same actor.

## Answer

Order: both sources merge into one list, newest first. Events sort by `created_at`, starred releases by `publishedAt`. No ranking and no boosting.

Collapse rules:

- Pushes: same repo, same actor, same ref, within 6 hours of each other, merge into one Change card. Other events may sit between them in time. The card sits at the newest push's time and shows "N pushes to {ref}" plus the commit list from one request: `GET /repos/{owner}/{repo}/compare/{oldest.before}...{newest.head}`.
- Stars and forks: same repo, same event type, within 24 hours, merge into one Repo card that lists the actors ("alice, bob, +1 starred X").
- Releases: a `ReleaseEvent` and the same release from the starred GraphQL source dedupe by release id. One Release card.

Card identity: a card's id is the newest event id in its group. Seen state keys on that id. When a new event joins a group, the id changes and the card counts as unseen again.
