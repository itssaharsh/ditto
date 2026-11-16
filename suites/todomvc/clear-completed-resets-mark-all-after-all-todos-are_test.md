---
assurance:
  id: t-18
  base: sha256:4200f2fd34d8f2fad50c88d23ba80c14b04e12537a7e48851d5dad9d5305fdb9
---
# Clear completed resets mark-all after all todos are completed

> With all todos completed and mark-all checked, clear them and observe the mark-all state reset.

## Step 1

At {{start_url}}, open the todo app's All list and establish at least one todo titled {{completed_todo_title}} with every todo completed and Mark all as complete checked.

## Step 2 @verifies ac-32, ac-34, ac-35

On the todo app's All list, use Clear completed, then assert no completed todos remain, Mark all as complete is unchecked, and Clear completed is hidden.
