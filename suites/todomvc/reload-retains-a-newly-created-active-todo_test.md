---
assurance:
  id: t-24
  base: sha256:77944b34dae58758f41cc34b29dfb0a6569916901443d51643ac47c50226ac25
---
# Reload retains a newly created active todo

> Create an active todo, reload, and establish its saved title and active completion state are retained in localStorage.

## Step 1

Open {{start_url}} in the browser and navigate to the todo list.

## Step 2 @verifies ac-46, ac-47

On the todo list, create a todo titled {{active_todo_title}}, then assert localStorage contains todo data reflecting the newly saved title under a todo name in the `todos-[framework]` format for this implementation.

## Step 3 @verifies ac-44, ac-45

Reload the todo list page, then assert {{active_todo_title}} is displayed in its saved active state.
