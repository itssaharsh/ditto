---
assurance:
  id: t-6
  base: sha256:3e2cca2fb8cd64fdbd081bd5e02f3f591321885592af0ae84294828ea8ef16fd
---
# Later arrival advances checkout to a one-night stay

> With checkout 11/23/2026 already set, changing check-in to 11/27/2026 advances checkout to 11/28/2026 and yields a one-night stay.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and clear the Check-in and Check-out fields through each open calendar's Ctrl+End shortcut.

## Step 2 @verifies ac-14

In the Check-in calendar, choose November 20, 2026, then assert Check-in shows 11/20/2026 in mm/dd/yyyy format.

## Step 3 @verifies ac-14

On the same booking page, choose November 23, 2026 in the Check-out calendar, then assert Check-out shows 11/23/2026 in mm/dd/yyyy format.

## Step 4 @verifies ac-13, ac-18, ac-19

On the same booking page, change Check-in in its calendar to November 27, 2026, then assert Check-out shows 11/28/2026, at least one calendar day after Check-in, and the stay-length line reads “1 night”.
