---
assurance:
  id: t-10
  base: sha256:0a1eb83b33db6f57d02177a47fbe25d6df30c244548dfd7ce65039bbe6db071b
---
# Availability rejects fully booked November nights

> The three fully booked November nights appear red with their legend in Availability and none can fill Check-in when selected there.

## Step 1 @verifies ac-41, ac-46, ac-47, ac-48, ac-49

At {{start_url}}, open the Lakeside Inn booking page and inspect the Availability calendar beside the form on first load, then assert it is visible, shows November 2026 with November 20 highlighted, marks November 24–26 red, and has a legend explaining that red means fully booked.

## Step 2 @verifies ac-42

In the Availability calendar on the Lakeside Inn booking page, attempt to choose each of November 24, 25 and 26, 2026 as the arrival day, then assert none of those fully booked days becomes the Check-in date.
