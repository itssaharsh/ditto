---
assurance:
  id: t-1
  base: sha256:7dd45146fd5ece2dd27ba80829bb67f1bfb0b8acb90e35066983557cf776692f
---
# Missing stay dates show the red booking error without navigation

> Submitting with check-in absent, check-out absent, or both absent produces the red missing-dates message without leaving or reloading the page.

## Step 1

Open {{start_url}} in the browser and reach the Lakeside Inn booking form; note the booking page's current URL and observe top-level document navigation requests during Book submissions.

## Step 2 @verifies ac-3, ac-4, ac-1, ac-2

On the booking form, leave Check-in empty and set Check-out to 11/23/2026; submit Book, then assert the message reads “Please choose check-in and check-out dates.” in red, the booking page URL remains unchanged, and the Book action caused no document reload.

## Step 3 @verifies ac-3, ac-4, ac-1, ac-2

On the booking form, set Check-in to 11/20/2026 and leave Check-out empty; submit Book, then assert the message reads “Please choose check-in and check-out dates.” in red, the booking page URL remains unchanged, and the Book action caused no document reload.

## Step 4 @verifies ac-3, ac-4, ac-1, ac-2

On the booking form, leave both Check-in and Check-out empty; submit Book, then assert the message reads “Please choose check-in and check-out dates.” in red, the booking page URL remains unchanged, and the Book action caused no document reload.
