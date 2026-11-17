---
assurance:
  id: t-4
  base: sha256:a51b4f8a177b82b6c22749750b6863614525ef285216076d26287820ca811a62
---
# Fully booked nights remain unavailable in both stay calendars

> In both date calendars, the three fully booked November nights are red, labelled on hover and cannot become selected dates.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and clear the Check-in and Check-out fields using each open calendar's Ctrl+End shortcut.

## Step 2 @verifies ac-15, ac-16

In the empty Check-in calendar on the Lakeside Inn booking page, inspect and hover November 24, 25 and 26, 2026, then assert each day is red and each hover shows “Fully booked”.

## Step 3 @verifies ac-12

In that Check-in calendar, attempt to choose November 24, 25 and 26, 2026, then assert none fills Check-in.

## Step 4 @verifies ac-14

In the Check-in calendar, choose November 20, 2026, then assert the Check-in field shows 11/20/2026.

## Step 5 @verifies ac-15, ac-16

On the same booking page, open the Check-out calendar, inspect and hover November 24, 25 and 26, 2026, then assert each is red and each hover shows “Fully booked”.

## Step 6 @verifies ac-12

In that Check-out calendar, attempt to choose November 24, 25 and 26, 2026, then assert none fills Check-out.
