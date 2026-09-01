# App shell: states and gestures

Type: grilling
Status: resolved
Blocked by: 

## Question

Around the card feed, what does the shell do? Decide: the loading state on cold open (skeleton card or spinner), the "caught up" empty state, the error state when the token is bad or the rate limit is hit, how the user refreshes (pull at the top is disabled by the fixed body, so a button or a background refetch on focus), whether an install-to-home-screen hint shows in Safari, and where the settings entry point lives on a card-only screen.

## Answer

- **Cold open**: show cached cards from the last session at once. Fresh cards slot in on top when the fetch lands. With an empty cache, show one skeleton card in the winning card layout (grey wash, placeholder bars) until the first fetch lands.
- **Caught up**: a "You're caught up" card always sits at the end of the feed. It shows the last-checked time and a Refresh button. It snaps like any card, so it appears after the last swipe.
- **Errors**: a card in the same shape as the caught-up card, with one specific message and one action. Bad token (401) and missing scope (403): "Open settings". Rate limited (403 with `x-ratelimit-remaining: 0`): "Retry" with the reset time. Offline with no cache: "Retry". Offline with cache: no card, a small "offline" chip top-left.
- **Refresh**: refetch on app open and on `visibilitychange` to visible. Manual refresh only via the Refresh button on the caught-up card. No custom pull gesture.
- **New cards mid-session**: a "N new" pill at the top of the viewport. Tap scrolls to the top. No silent insert.
- **Settings entry**: a 44 px gear icon top-right on every card, padded by `safe-area-inset-top`.
- **Install hint**: when `navigator.standalone === false` on iOS Safari, show a one-time dismissible hint to add to Home Screen. Dismissal stored in localStorage.
- **Landscape**: same single-card layout at any width and orientation. No rotate overlay.
