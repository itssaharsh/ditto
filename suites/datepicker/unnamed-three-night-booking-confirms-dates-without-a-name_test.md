---
assurance:
  id: t-3
  base: sha256:9f350363cfde62e8a5877d704b1ab7a94bc3a07c4f22f7a2f90f30c6a1c26bfd
---
# Unnamed three-night booking confirms dates without a name

> Submitting 11/20/2026 to 11/23/2026 with empty Full name shows the dated three-night confirmation without a name phrase, on the same page without reload.

## Step 1

Open {{start_url}} in the browser and reach the Lakeside Inn booking form; note the booking page's current URL and observe top-level document navigation requests during Book submission.

## Step 2 @verifies ac-8, ac-9, ac-10, ac-1, ac-2

On the booking form, leave Full name empty, set Check-in to 11/20/2026 and Check-out to 11/23/2026, and submit Book, then assert the in-page booking confirmation contains “3 nights” and “11/20/2026 to 11/23/2026” but no “for [Full name]” segment, the booking page URL remains unchanged, and the Book action caused no document reload.
