---
assurance:
  id: t-22
  base: sha256:371df79d6a25d4b3f0d2829974e8a9a5db9c1dbc92d99bc3f3336f80298dde9f
---
# Hide main and footer with zero todos

> With no todos, the main list and footer are hidden, independent of the route's displayed matching subset.

## Step 1

Open {{start_url}} in the browser and reach the TodoMVC todo page's All view (#/) so all existing todos are visible.

## Step 2 @verifies ac-42, ac-43

On the TodoMVC All view, remove every existing todo through each item's remove control until no todos exist, then assert `#main` and `#footer` are hidden.
