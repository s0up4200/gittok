# Card layout prototype

Type: prototype
Status: resolved
Blocked by: 05, 08

## Question

Build one real React card per kept event type inside the scaffolded app, with the two v1 actions (star, open on GitHub) placed for one-hand use. Follow the mobile-adapt rules: 44px targets, safe areas, no horizontal scroll, large-text reflow. Review on an iPhone in standalone mode. Which layout wins, and what does each event type show?

## Answer

Winner: variant J, a merge of E (avatar wash) and G (stats). Ten variants were built and reviewed on an iPhone; A (TikTok rail) won the layout, then the empty middle was filled by trying backgrounds D through I.

The winning card, for the spec:

- **Background**: the actor's avatar at 400 px, scaled to 140 %, blurred 60 px, saturated, at 45 % opacity. Every card gets a colour wash with no extra request. Black base.
- **Top**: event type label in 44 px bold ("Release", "Push", "PR merged", "Issue opened", "Star", "Fork", "New repo", "Went public"), then a stats row: stars, forks, open issues as 26 px numbers with 13 px captions, plus a language dot in the language colour. Padded by `safe-area-inset-top`.
- **Bottom-left body**: actor line (36 px avatar, "alice, bob +1 starred", relative time), repo name in 30 px with owner and name on two lines, title in 19 px, a bulleted body list capped at 40 dvh, a dim meta line. Padded by `safe-area-inset-bottom`.
- **Bottom-right rail**: two 56 px round buttons stacked, Star (toggles, gold when on) and Open (external link). In the thumb zone.
- All text wraps with `overflow-wrap: anywhere`. No horizontal scroll. Smallest tap target 48 px.

Rejected: B poster, C reader, D preview image (GitHub's auto card looks bad for repos without custom art), F preview-or-mesh, H content texture, I contributor mosaic.

Facts the real build needs: stats and language come from `Repository` fields in the same GraphQL query as starred releases, or from `GET /repos/{o}/{r}` once per repo for received events. `usesCustomOpenGraphImage` exists on GraphQL `Repository` if preview images ever return.

Prototype code: `src/PrototypeFeed.tsx` and the prototype block at the end of `src/index.css`. Not committed; the repo has no commits yet. Move it to a `prototype/card-layout` branch at first commit, and replace it with the real Feed in `/implement`.
