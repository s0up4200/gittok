# GitTok

A mobile-first PWA that shows your GitHub feed as full-screen cards you swipe through vertically.

## Language

**Feed**:
The ordered stream of Events the user swipes through. Built from the user's followed activity plus releases from starred repos.
_Avoid_: Timeline, stream, dashboard

**Event**:
One item GitHub reports in `received_events` (a push, a star, a release, a fork, a pull request). The unit the Feed is built from.
_Avoid_: Activity, notification, item

**Card**:
One full-screen view in the Feed. Shows one Event, or one collapsed group of Events from the same repo.
_Avoid_: Tok, post, slide

**Source**:
Where Events come from. Two kinds: followed activity (`received_events`) and starred releases.
_Avoid_: Channel, subscription

**Token**:
The GitHub personal access token the user pastes in. The only credential the app holds.
_Avoid_: API key, login, session

**Card shape**:
One of three layouts a Card uses: Repo, Change, or Release. The Event type selects the shape.
_Avoid_: Template, card type, variant

**Group**:
A set of Events merged into one Card by the collapse rules. A Card's identity is the newest Event in its Group.
_Avoid_: Bundle, cluster, digest

**Seen**:
A Card the user has swiped past or held fully in view for one second. Seen Cards leave the Feed.
_Avoid_: Read, watched, viewed, consumed

**End card**:
The Card that always closes the Feed: "caught up", or an error when the fetch failed. Never an Event.
_Avoid_: Empty state, error screen, footer
