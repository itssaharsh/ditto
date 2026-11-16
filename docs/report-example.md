## Ditto: did the rewrite break anything?

**No.** 18 of 18 behaviours act the same on the React rewrite as on the jQuery app, checked by Kane CLI (2026-11-16).

| Behaviour | jQuery | React | How Kane checked |
|---|---|---|---|
| Blank new-todo submissions do not add a todo | same | same | replay of the old app's recording |
| Checking an Active todo removes it from the Active list | same | same | replay of the old app's recording |
| Clear completed preserves active todos in a mixed list | same | same | replay of the old app's recording |
| Completed route displays only completed todos | same | same | replay of the old app's recording |
| Completed todos leave the active counter at zero | same | same | replay of the old app's recording |
| Deleting a completed todo removes it from All after reload | same | same | written fresh by Kane |
| Deleting one active todo preserves its neighbour | same | same | replay of the old app's recording |
| Deleting the last todo hides the empty-list containers | same | same | replay of the old app's recording |
| Empty edited titles destroy the todo on Enter or blur | same | same | replay of the old app's recording |
| Enter appends trimmed todo and clears new-todo input | same | same | replay of the old app's recording |
| Enter saves a trimmed todo title | same | same | replay of the old app's recording |
| Escape discards a todo title edit | same | same | replay of the old app's recording |
| Hide Clear completed without completed todos | same | same | replay of the old app's recording |
| Mark-all checks every todo in All | same | same | replay of the old app's recording |
| Mark-all reactivates every completed todo | same | same | replay, healed |
| New-todo input receives focus on page load | same | same | replay of the old app's recording |
| One active todo displays a singular counter | same | same | replay of the old app's recording |
| Two active todos display a plural counter | same | same | replay of the old app's recording |

<details><summary>Kane said → Claude Code fixed</summary>

**Round 1** (commit `62752c5`)
- Kane on "Completed todos leave the active counter at zero": After all todos are completed, the footer does not meet the required zero-item counter format.
- Kane on "Escape discards a todo title edit": Pressing Escape left edit mode but kept the replacement title instead of restoring the original title.
- Claude Code: I fixed both failures, and the build passes. I didn't re-run the Kane tests, and I didn't read the legacy source or the screenshots. The fixes follow from Kane's descriptions and the code. - Footer counter: In Footer.tsx, the pluralize check was count <= 1, so zero showed as "0 item left".

**Round 2** (commit `40f2c99`)
- Kane on "Completed todos leave the active counter at zero": The mark-all control does not complete the remaining “Book the dentist” todo, so the list cannot reach zero items using the requested action.
- Claude Code: I fixed the mark-all failure in App.tsx, and the build passes. I didn't re-run the Kane test or read the screenshots or the legacy source. The mark-all checkbox was checked whenever there were one or fewer active todos (active.length <= 1).

</details>

10 of the 28 tests Kane designed from the spec are not counted: the jQuery app fails them or Kane could not run them cleanly on it, so they cannot judge the rewrite.

Kane runs: 61 (40 pure replays), 480 credits. Every result, with Kane's screenshots of both apps: https://itssaharsh.github.io/ditto/?case=todomvc-mutation
