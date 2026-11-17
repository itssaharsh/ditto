---
assurance:
  id: t-2
  base: sha256:4a2e9cd1a443bbc344167afabd6d331ef5d0485ecb312642bf72f8b2749d53dd
---
# Named one-night booking confirms dates without navigation

> Submitting 11/20/2026 to 11/21/2026 for Ada Lovelace shows the dated confirmation with her name and singular 1 night, on the same page without reload.

## Step 1

Open {{start_url}} in the browser and reach the Lakeside Inn booking form; note the booking page's current URL and observe top-level document navigation requests during Book submission.

## Step 2 @verifies ac-5, ac-6, ac-7, ac-1, ac-2

On the booking form, enter Ada Lovelace in Full name, set Check-in to 11/20/2026 and Check-out to 11/21/2026, and submit Book, then assert the in-page booking confirmation contains “1 night”, “for Ada Lovelace”, and “11/20/2026 to 11/21/2026”, the booking page URL remains unchanged, and the Book action caused no document reload.
