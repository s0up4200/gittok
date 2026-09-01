# Settings screen and star action

Type: grilling
Status: resolved
Blocked by: 10

## Question

Settings: where the user pastes the token, which token kind the screen asks for (classic or fine-grained, decided by the real-token task), where the token lives (localStorage vs IndexedDB), what the screen shows when the token is missing, expired, or lacks a scope, and the "Mark all unseen" button.

Star action: `PUT /user/starred/{owner}/{repo}` from the rail button. Optimistic toggle or wait for the response, undo, and what a card shows when the repo is already starred on load (needs `viewerHasStarred` or `GET /user/starred/{o}/{r}` per card).

## Answer

Settings:

- A full-screen `/settings` route, normal document flow, back button. Not a sheet: text inputs in fixed containers break on iOS (WebKit bug 153224).
- Contents: token input (`type="password"`, `autocomplete="off"`), a "Create token" link to GitHub's new-token page pre-filled with `scopes=public_repo&description=GitTok`, Save, login and avatar confirmation from `GET /user`, "Mark all unseen", "Sign out" (clears token, seen set, and cache), version string, link to the repo.
- First run with no token opens straight to settings.
- Token lives in localStorage as a plain string. The app loads no third-party scripts.
- Token errors: 401 anywhere clears the feed and shows the end card "Token rejected, open settings". 403 with an accepted-scopes header shows "Token needs public_repo". Settings shows the same message above the input. The stored token stays until replaced.

Star action:

- Star state comes from the starred-repos GraphQL query that already runs on open: one set of `nameWithOwner`, checked locally. No per-card request.
- Tap toggles at once (gold) and sends `PUT` or `DELETE /user/starred/{owner}/{repo}` in the background. On failure, revert and show a small toast. Second tap unstars. No confirm dialog.
- A repo starred from a card joins the starred-releases source on the next fetch. No immediate refetch.
