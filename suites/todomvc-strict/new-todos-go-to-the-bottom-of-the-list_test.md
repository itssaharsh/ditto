# New todos go to the bottom of the list

> Rewritten from "Enter appends trimmed todo and clears new-todo input", which passed on a build that puts new todos at the top: the old sentence named the new item but not where it goes.

## Step 1

Open {{start_url}} in the browser and load the todo app, then, in the new-todo input at the top, type 'Buy milk' and press Enter, then assert the todo list shows exactly one row and it reads 'Buy milk'.

## Step 2

In the same new-todo input, type 'Call home' and press Enter, then assert the todo list shows exactly two rows, the upper row reads 'Buy milk' and the lower row reads 'Call home'.
