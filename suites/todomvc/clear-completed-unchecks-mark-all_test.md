---
assurance:
  id: t-13
  base: sha256:d0fd87a41bb26dac31d67cb7fd95a5c94a974ada53a601b8f0234b7567d73d5c
---
# Clear completed unchecks mark-all

> With all todos completed and mark-all checked, click Clear completed; the mark-all checkbox's checked state clears.

## Step 1

Open the todo application at {{start_url}} and show the All todo list.

## Step 2

In the new-todo input at the top of the application, create todos named 'Clear alpha' and 'Clear beta' if they are not already present.

## Step 3

On the All list, check the 'Mark all as complete' checkbox so every existing todo is completed.

## Step 4 @verifies ac-23

On the All list, use 'Clear completed' and inspect the 'Mark all as complete' checkbox's DOM checked state even if the empty list hides the main section, then assert that checkbox is unchecked.
