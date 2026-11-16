---
assurance:
  id: t-25
  base: sha256:9f46a4fa24ca90f803fe3517ff57495548fe8730329da53204d4c7cc81ac8c9f
---
# Reload does not restore todo editing mode

> Enter editing mode for an already saved todo and reload before saving an edit; establish that editing mode does not resume.

## Step 1

Open {{start_url}} in the browser and navigate to the todo list.

## Step 2

On the todo list, create an active todo titled {{active_todo_title}} and locate that saved item.

## Step 3

On the saved {{active_todo_title}} item, enter title editing mode without saving a new title.

## Step 4 @verifies ac-44, ac-45, ac-48

Reload the todo list page while that item is in editing mode, then assert {{active_todo_title}} is displayed in its saved active state without editing mode.
