---
assurance:
  id: t-12
  base: sha256:07919df33c3c4cf707f9391f47177320c9535089610ab75db0fc3e1aff4084c8
---
# Availability fills free arrival while checkout is empty

> On initial load inspect the persistent November 2026 Availability calendar, then choose the free 11/20/2026 to fill Check-in while the incomplete stay still prompts for dates.

## Step 1 @verifies ac-41, ac-46, ac-47, ac-48, ac-49

At {{start_url}}, open the Lakeside Inn booking page and inspect the Availability calendar beside the form on first load, then assert it is visible, shows November 2026 with November 20 highlighted, marks November 24–26 red, and has a legend explaining that red means fully booked.

## Step 2 @verifies ac-43, ac-45

On the Lakeside Inn booking page with Check-out empty, choose the free November 20, 2026 day from the Availability calendar, then assert Check-in reads 11/20/2026 and the stay-length line reads Choose your dates.
