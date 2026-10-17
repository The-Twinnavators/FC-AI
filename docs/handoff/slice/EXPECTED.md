# Slice: expected results

Input: [clean-cart-slice-prd.md](clean-cart-slice-prd.md). Journey: Home → search → product detail → save → Saved.

| # | Action | Expected |
|---|---|---|
| 1 | Open the app | Home shows Clean Cart content (no library demo content: no pottery studio, no clothing/"Studio wear", no "SAMPLE" text) and a search box; the top bar shows Home, Search, Saved |
| 2 | Search "oat" | Results include "Oat Milk Original" (Willow Farms) and "Rolled Oats" (Sunrise Valley); nothing unrelated |
| 3 | Search "zzzz" | A no-results message |
| 4 | Open "Oat Milk Original" | Product page shows Oat Milk Original, Willow Farms, Beverages, Non-GMO Project Verified, "Oats, water, sea salt" |
| 5 | Sign in (one tap, demo member), press Save | The button shows it's saved |
| 6 | Open Saved | "Oat Milk Original" (Willow Farms) is listed; opening it shows the same product (step 4) |
| 7 | Reload the page, open Saved | "Oat Milk Original" is still listed |
| 8 | Navigation | Each top-bar link opens the screen it names |

Technical: type check, lint, tests, production build and preview health pass; no uncaught page errors during 1–8.

Not tested in this slice: comments, ratings, store selection, grocery lists, real accounts.
