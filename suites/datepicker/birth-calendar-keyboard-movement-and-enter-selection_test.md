---
assurance:
  id: t-9
  base: sha256:2f6b0e4dd3b65f4418158b517c7fc0f231348e25b06f919bdd818b77a940511b
---
# Birth calendar keyboard movement and Enter selection

> Move through months, years, days and weeks using the specified keys, then choose a highlighted valid day with Enter.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and locate the Date of birth field.

## Step 2

Use the Date of birth calendar to choose 15 March 1990 and reopen it with that date selected.

## Step 3 @verifies ac-26

In the open Date of birth calendar displaying March 1990, use Page Up, then assert the calendar displays February 1990.

## Step 4 @verifies ac-27

In the Date of birth calendar displaying February 1990, use Page Down, then assert the calendar displays March 1990.

## Step 5 @verifies ac-28

In the Date of birth calendar displaying March 1990, use Ctrl+Page Up, then assert the calendar displays March 1989.

## Step 6 @verifies ac-29

In the Date of birth calendar displaying March 1989, use Ctrl+Page Down, then assert the calendar displays March 1990.

## Step 7

Position the highlighted day on 15 March 1990 in the open Date of birth calendar.

## Step 8 @verifies ac-31

From the highlighted 15 March 1990, use Ctrl+Left, then assert the highlighted day is 14 March 1990.

## Step 9 @verifies ac-32

From the highlighted 14 March 1990, use Ctrl+Right, then assert the highlighted day is 15 March 1990.

## Step 10 @verifies ac-33

From the highlighted 15 March 1990, use Ctrl+Up, then assert the highlighted day is 8 March 1990.

## Step 11 @verifies ac-34

From the highlighted 8 March 1990, use Ctrl+Down, then assert the highlighted day is 15 March 1990.

## Step 12 @verifies ac-22, ac-35, ac-36

With 15 March 1990 highlighted in the Date of birth calendar, press Enter, then assert the field reads 15/03/1990 and the calendar is closed.
