# A spaces-only entry adds no row and no counter

> Rewritten from "Blank new-todo submissions do not add a todo", which passed on a build that adds an empty row: the old sentence counted todos, and an empty row has no title to count.

## Step 1

Open {{start_url}} in the browser and load the todo app, then, in the new-todo input at the top, type three spaces and press Enter, then assert the page shows no todo rows at all, not even an empty one, and no "item left" or "items left" counter is shown.
