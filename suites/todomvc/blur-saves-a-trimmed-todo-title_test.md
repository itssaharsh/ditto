---
assurance:
  id: t-4
  base: sha256:e4b3cf2092f9ffde9a7310b4e1a059bb8a8880e7e69e417693468aecea177026
---
# Blur saves a trimmed todo title

> A nonblank edited title is trimmed and committed when the input loses focus.

## Step 1

At {{start_url}}, create a todo titled 'Review proposal' using the new-todo input at the top of the todo app.

## Step 2 @verifies ac-1, ac-3, ac-4, ac-5

In the todo list, double-click the newly created 'Review proposal' item's label to edit it, then assert its item has the editing class, its focused edit input contains 'Review proposal', and its other controls are hidden.

## Step 3 @verifies ac-2, ac-9

In that todo's edit input, enter '  Review contract  ' and move focus away from the input, then assert the item no longer has the editing class and its displayed title equals 'Review contract'.
