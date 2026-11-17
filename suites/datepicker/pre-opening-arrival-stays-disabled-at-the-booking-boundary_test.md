---
assurance:
  id: t-5
  base: sha256:b004cdbab9f8d3b8828999bc5a30558adce2b4b04ad1fff4e87a30fb9f3f1ef3
---
# Pre-opening arrival stays disabled at the booking boundary

> In Check-in, the day immediately before the advertised start is greyed out, clicking it does not select it, and opening day is eligible.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and clear Check-in through its open calendar's Ctrl+End shortcut.

## Step 2 @verifies ac-17

In the Check-in calendar, navigate to November 2026 and inspect November 9, then assert that day is greyed out.

## Step 3 @verifies ac-11

In that Check-in calendar, attempt to choose November 9, 2026, then assert no date before 11/10/2026 fills Check-in.

## Step 4 @verifies ac-14

In the Check-in calendar, choose the first eligible day, November 10, 2026, then assert Check-in shows 11/10/2026 in mm/dd/yyyy format.
