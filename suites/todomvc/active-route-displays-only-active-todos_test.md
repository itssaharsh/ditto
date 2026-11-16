---
assurance:
  id: t-20
  base: sha256:ba6a2f58fe2fa5e8353a70a5c1984ffa2ee44960ad52fd6d1bb2508525d6aac9
---
# Active route displays only active todos

> With a known active todo and a known completed todo, navigate to #/active and prove that only the active item belongs to the displayed view.

## Step 1

Open {{start_url}} in the browser and, on the TodoMVC todo page, establish an active todo titled {{active_todo_title}} and a completed todo titled {{completed_todo_title}} using the new-todo input and each todo's completion checkbox.

## Step 2 @verifies ac-37

On the TodoMVC page's footer filter links, navigate to Active (#/active), then assert the Active filter link has the `selected` class.

## Step 3 @verifies ac-36, ac-38, ac-40

On the Active view's todo list, inspect the displayed todo titles and completion states, then assert every displayed todo is active, {{active_todo_title}} is present, and {{completed_todo_title}} is absent.
