---
assurance:
  id: t-7
  base: sha256:8c23e9f86584ad5f136c54e04867848f5fbd31600c3907ce42bb7c746fb97579
---
# Post-cutoff birth dates are unavailable

> In the Date of birth calendar, inspect January 2009 to establish that a post-12/31/2008 day cannot be selected.

## Step 1

At {{start_url}}, open the Lakeside Inn booking page and locate its Date of birth field.

## Step 2 @verifies ac-21, ac-23, ac-24

In the Date of birth calendar, inspect the header controls and the year choices, then assert a month menu appears in the header, a year menu appears in the header, and the year choices contain exactly 1930 through 2008.

## Step 3 @verifies ac-20

In the Date of birth calendar, inspect the last permitted month and the available date/year choices after 12/31/2008, then assert no Date of birth date after 12/31/2008 is selectable.
