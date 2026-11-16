## Ditto: did the rewrite break anything?

**Yes.** Kane CLI confirmed 6 of 18 behaviours act differently on the React rewrite, and could not tell on 1 (2026-11-16).

### What changed
- **Checking an Active todo removes it from the Active list**: After completing Assurance active A, the Active list hides it correctly but the mark-all checkbox is still checked while Assurance active B remains active.
- **Completed todos leave the active counter at zero**: With every todo completed, the footer does not meet the required zero-item counter format.
- **Escape discards a todo title edit**: Pressing Escape closes todo editing but keeps “Review contract” instead of restoring “Review proposal.”
- **Mark-all checks every todo in All**: Using Mark all as complete did not complete every todo in the All list.
- **One active todo displays a singular counter**: Selecting the mark-all checkbox leaves “Book the dentist” active even though the control shows as checked.
- **Two active todos display a plural counter**: The mark-all control showed completion but did not complete the remaining “Pay rent” todo.

| Behaviour | jQuery | React | How Kane checked |
|---|---|---|---|
| Blank new-todo submissions do not add a todo | same | same | replay of the old app's recording |
| Checking an Active todo removes it from the Active list | same | **different** | replay, healed |
| Clear completed preserves active todos in a mixed list | same | unclear | written fresh by Kane |
| Completed route displays only completed todos | same | same | replay, healed |
| Completed todos leave the active counter at zero | same | **different** | replay, healed |
| Deleting a completed todo removes it from All after reload | same | same | written fresh by Kane |
| Deleting one active todo preserves its neighbour | same | same | replay of the old app's recording |
| Deleting the last todo hides the empty-list containers | same | same | replay of the old app's recording |
| Empty edited titles destroy the todo on Enter or blur | same | same | replay of the old app's recording |
| Enter appends trimmed todo and clears new-todo input | same | same | replay of the old app's recording |
| Enter saves a trimmed todo title | same | same | replay of the old app's recording |
| Escape discards a todo title edit | same | **different** | replay, healed |
| Hide Clear completed without completed todos | same | same | replay of the old app's recording |
| Mark-all checks every todo in All | same | **different** | written fresh by Kane |
| Mark-all reactivates every completed todo | same | same | written fresh by Kane |
| New-todo input receives focus on page load | same | same | replay of the old app's recording |
| One active todo displays a singular counter | same | **different** | written fresh by Kane |
| Two active todos display a plural counter | same | **different** | written fresh by Kane |

10 of the 28 tests Kane designed from the spec are not counted: the jQuery app fails them or Kane could not run them cleanly on it, so they cannot judge the rewrite.

Kane runs: 37 (19 pure replays), 539 credits. Every result, with Kane's screenshots of both apps: https://itssaharsh.github.io/ditto/?case=todomvc-recheck
