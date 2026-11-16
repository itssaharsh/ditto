---
assurance:
  id: t-10
  base: sha256:377f00dc162c21e4d2dd69e7c762c3348f0ffcc70dbf8d16f9352cf88bdbd22c
---
# Completing the last active todo checks mark-all

> Checking the last active todo leaves it in All, gives it completed styling, checks mark-all, and saves its state.

## Step 1

Open {{start_url}} in the browser and reach the todo app's All list.

## Step 2

On the todo app's All list, remove any existing todos with their item remove controls, then create two todos titled 'Assurance last active' and 'Assurance already complete' using the new-todo input and check only 'Assurance already complete'.

## Step 3 @verifies ac-16, ac-17, ac-18

On the todo app's All list, check 'Assurance last active', then assert its checkbox is checked, its parent li has the completed class, and the mark-all checkbox is checked.

## Step 4 @verifies ac-19

Reload the todo app's All list and inspect the localStorage todo record for 'Assurance last active', then assert its stored completed value is true.
