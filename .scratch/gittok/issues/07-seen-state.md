# Seen state and resume position

Type: grilling
Status: resolved
Blocked by: 06

## Question

What does the app remember between opens? Options: nothing; last-seen card id and resume there; mark seen cards dim but start at top. Where does it live (localStorage) and what is the card identity used as the key, given collapse? Starting gut: remember last-seen id, start at top, dim seen cards.

## Answer

A card is seen when the user swipes past it (it leaves the viewport upward) or when it is fully in the viewport for 1 second, whichever comes first.

The app stores the set of seen card ids in localStorage under one key. Prune ids for cards older than the 30-day feed window. Cap the set at 1000 ids, oldest dropped first.

Seen cards are hidden. The feed shows unseen cards only, newest first, so the app always starts at the top. When no unseen cards remain, show a "caught up" empty state.

Storage does not survive installing the PWA to the home screen (installed app starts with empty storage). Accepted: a one-time replay.

Settings holds a "Mark all unseen" button that clears the set and replays the feed. Settings is the same screen that holds the token.

Context from this session: GitTok will be open source and self-hostable. Auth stays PAT; each person hosts their own copy.
