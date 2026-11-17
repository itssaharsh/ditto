---
assurance:
  id: t-11
  base: sha256:61c4c4dde66fcd7dbe1ccf08ee4ebc253e7fe3ac632ea7b57b69018512ce01ea
---
# Availability advances checkout for later free arrival

> With checkout 11/23/2026 already filled, choosing the free 11/27/2026 from Availability fills Check-in, advances checkout to 11/28/2026 and yields 1 night.

## Step 1 @verifies ac-41, ac-46, ac-47, ac-48, ac-49

At {{start_url}}, open the Lakeside Inn booking page and inspect the Availability calendar beside the form on first load, then assert it is visible, shows November 2026 with November 20 highlighted, marks November 24–26 red, and has a legend explaining that red means fully booked.

## Step 2

On the Lakeside Inn booking page, set the Check-out field to 11/23/2026 using its calendar.

## Step 3 @verifies ac-43, ac-44, ac-45

On the Lakeside Inn booking page, choose the free November 27, 2026 day from the Availability calendar beside the booking form, then assert Check-in reads 11/27/2026, Check-out reads 11/28/2026 and the stay-length line reads 1 night.
