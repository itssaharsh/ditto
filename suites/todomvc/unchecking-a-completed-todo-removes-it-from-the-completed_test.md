---
assurance:
  id: t-9
  base: sha256:2f0df1ec6ab617c0fe8cd740fb54bc2f9fed057759cee95bea7f1648ef8137a1
---
# Unchecking a Completed todo removes it from the Completed list

> Unchecking a visible completed todo removes it from Completed and causes mark-all to clear when all were previously checked.

## Step 1

Open {{start_url}} in the browser and reach the todo app's All list.

## Step 2

On the todo app's All list, remove any existing todos with their item remove controls, then create two todos titled 'Assurance completed A' and 'Assurance completed B' using the new-todo input and check each todo so both are completed.

## Step 3 @verifies ac-21, ac-18

On the todo app's Completed filter, uncheck 'Assurance completed A', then assert 'Assurance completed A' is absent from the Completed list and the mark-all checkbox is unchecked.

## Step 4 @verifies ac-16, ac-17

Return to the All filter and inspect 'Assurance completed A', then assert its checkbox is unchecked and its parent li does not have the completed class.

## Step 5 @verifies ac-19

Reload the todo app's All list and inspect the localStorage todo record for 'Assurance completed A', then assert its stored completed value is false.
