---
assurance:
  id: t-8
  base: sha256:1bf0a97ea7d1f0100076e4655ebdb5b37405dd6709365285501ca2838446305a
---
# Supported birth dates use the required format

> From an empty field, inspect the initial month and menu range; choose a supported day and observe dd/mm/yyyy.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and locate its Date of birth field.

## Step 2

Clear any existing Date of birth value using the calendar's documented Ctrl+End shortcut.

## Step 3 @verifies ac-25

Open the empty Date of birth calendar, then assert the displayed month is January 1990.

## Step 4 @verifies ac-21, ac-23, ac-24

Inspect the Date of birth calendar header and its year choices, then assert both month and year menus appear and the year menu lists exactly 1930 through 2008.

## Step 5 @verifies ac-22

On the Date of birth calendar choose 15 March 1990, then assert the Date of birth field reads 15/03/1990.

## Step 6 @verifies ac-22

Using the Date of birth calendar select 31 December 2008, then assert the field reads 31/12/2008.

## Step 7 @verifies ac-22

Using the Date of birth calendar select 1 January 1930, then assert the field reads 01/01/1930.
