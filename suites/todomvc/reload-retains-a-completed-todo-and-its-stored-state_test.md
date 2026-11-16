---
assurance:
  id: t-23
  base: sha256:53d5fe90ca71fa07c92bc238516410bd1a4ab91571cb7015c318414c242251ef
---
# Reload retains a completed todo and its stored state

> Create a todo, complete it, reload, and establish that the saved title and completed state return, with the change dynamically stored under the framework-specific todo name.

## Step 1

Open {{start_url}} in the browser and navigate to the todo list.

## Step 2 @verifies ac-46, ac-47

On the todo list, create a todo titled {{completed_todo_title}}, then assert localStorage contains todo data reflecting the newly saved title under a todo name in the `todos-[framework]` format for this implementation.

## Step 3 @verifies ac-46

On the todo list, mark the {{completed_todo_title}} item complete, then assert the stored todo data reflects its completed state.

## Step 4 @verifies ac-44, ac-45

Reload the todo list page, then assert {{completed_todo_title}} is displayed with the completed state.
