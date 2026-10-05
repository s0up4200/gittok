# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Wayfinder labels

`/wayfinder` puts these labels on the map issue and on its child tickets.

| Label                 | Meaning                                       |
| --------------------- | --------------------------------------------- |
| `wayfinder:map`       | The map issue, which holds the decisions      |
| `wayfinder:research`  | A ticket that reading primary sources answers |
| `wayfinder:prototype` | A ticket that throwaway code answers          |
| `wayfinder:grilling`  | A ticket that an interview with the user answers |
| `wayfinder:task`      | A ticket that a small piece of work answers   |
