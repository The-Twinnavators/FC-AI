# Clean Cart: PRD

A rewrite of the No-GMO PRD (Build tests 1 to 7: "People need a way to find healthy food options") as a complete,
working prototype of an information app: a landing page, verified products by category, search, where each product is
available near the person's ZIP code, grocery lists tied to a nearby store, and social features on every product.
Clean Cart sells nothing: it tells people what is free of GMO and bio-engineered ingredients and where to find it.

## 1. Summary

Clean Cart is an information app. It helps busy parents and working professionals look up food that has no GMO and no
bio-engineered ingredients, understand why it qualifies, and find out whether a store near them carries it, so they can
shop without reading every label in the aisle. The ZIP code is how Clean Cart knows which stores are near them. Every
product is verified (Non-GMO Project Verified or USDA Organic, and no "bioengineered food" disclosure) and shows where
that claim comes from. Clean Cart does not sell anything; people buy at their own store.

## 2. Goals

- A first-time visitor understands what Clean Cart is and starts looking things up in under 10 seconds.
- A person finds out whether a food is free of GMO and bio-engineered ingredients in under 30 seconds.
- A person enters their ZIP code once and sees, for any product, which nearby stores carry it.
- A person builds a grocery list for a chosen store and sees, for each item, whether that store carries it.
- People like, save, share, rate and comment on products, so the most trusted products rise to the top.

## 3. People

| Role | What they do |
|---|---|
| Member (signed in as a demo account) | Looks up products, checks availability near their ZIP, builds grocery lists, likes, saves, rates and comments. |
| Visitor (not signed in) | Sees the landing page, looks up products and checks availability; liking, saving, rating and lists ask them to sign in (one tap in the prototype). |

## 4. Main screens

| Screen | Purpose |
|---|---|
| Home (landing page) | What Clean Cart is, why non-GMO matters in one line, a search box, featured categories and featured products, and how it works in three steps. |
| Categories | Every product category with a picture and a count; opening one shows its products. |
| Category | The products in one category as a grid, with filters (certification, dietary, available near me) and sort (most liked, top rated, newest). |
| Search | Results for a search across product names, brands and categories, with the same filters, and a no-results state that suggests categories. |
| Product | One product: photo, brand, why it qualifies (certification, no bioengineered disclosure, and the source), ingredients, which stores near the ZIP carry it, like, save, share, add to list, average rating with a breakdown, and comments. |
| Grocery lists | The member's lists; create a list, choose its store, add, check off and remove items. |
| Choose a store | Enter a ZIP code to see nearby stores (name, address, distance, how many Clean Cart products they carry), and choose one for a list. |
| Saved | The products the member saved. |

## 5. Navigation

A top bar with the Clean Cart logo, Categories, a search box, Grocery lists, Saved and the account; on phones a bottom
bar with Home, Categories, Search, Lists and Saved. The ZIP code and chosen store show in the top bar ("Near 94110 ·
Green Valley Market") and change in one tap. A first visit asks for the ZIP code once, and can be skipped.

## 6. Records

### Products
- Name, brand, category, photo, short description, size (e.g. "16 oz")
- Why it qualifies: Non-GMO Project Verified, USDA Organic, or both; no "bioengineered food" disclosure on the pack; with the source ("Non-GMO Project product verification, checked March 2026")
- Dietary tags: gluten-free, vegan, dairy-free, nut-free, keto
- Ingredients
- Likes count, saves count, average rating (1 to 5) and rating count
- Which stores carry it

### Categories
Produce, Dairy and eggs, Bakery, Pantry staples, Snacks, Breakfast and cereal, Frozen, Beverages, Baby and kids, Meat and plant protein.

### Stores
- Name, chain, address, ZIP code, distance from the entered ZIP, opening hours
- Which products they carry

### Grocery lists
- Name ("Weekly shop", "Taco night"), the chosen store, items (product, quantity, checked off or not), created and updated dates

### Ratings and comments
- Product, the member's name, stars (1 to 5), comment text, date, helpful count

## 7. Requirements

### 7.1 Landing page
- R1. The landing page has a hero with the promise ("Food without GMOs, without reading every label"), a search box, a ZIP code box ("Find it near you") and a "Browse categories" action.
- R2. Featured categories (6) and featured products (8, the most liked this week) link to their pages.
- R3. "How it works" explains three steps: look up a food, see which stores near you carry it, plan your list.
- R4. A short trust section explains, in plain words, what GMO and bio-engineered ingredients are, what Non-GMO Project Verified and USDA Organic mean, and how Clean Cart checks each product.

### 7.2 Categories and products
- R5. The categories page shows every category with its product count.
- R6. A category page shows its products as cards: photo, name, brand, certification badge, average rating and a save button.
- R7. Products filter by certification, dietary tag and "available near me", and sort by most liked, top rated and newest; the filters show as removable chips with a "Clear all".
- R8. With a ZIP code entered, each card shows how many nearby stores carry it ("At 3 stores near 94110"); with a store chosen, whether that store does.

### 7.3 Search
- R9. Search works from the top bar on every page, matching product names, brands, categories and dietary tags as the person types, with suggestions under the box.
- R10. The results page shows the count, the same filters and sort, and highlights the matched words.
- R11. No results suggests similar categories and clearing filters.

### 7.4 Product page
- R12. The product page shows the photo, name, brand, size, why it qualifies with its source, dietary tags, ingredients, and the stores near the ZIP code that carry it (name, distance, address, hours), nearest first. Without a ZIP, it asks for one.
- R13. Like toggles with a count that updates at once; liking twice is not possible.
- R14. Save toggles and the product appears on the Saved page.
- R15. Share opens the device's share sheet when available; otherwise it offers copy link, email and the main social networks, and confirms "Link copied".
- R16. "Add to list" adds it to a chosen grocery list (or a new one), with a quantity.
- R17. Ratings show the average, the count and a 5-to-1 star breakdown; a signed-in member rates 1 to 5 stars and may add a comment.
- R18. Comments list newest first with the name, stars, date and a "Helpful" button; a member can edit or delete their own; a comment can't be empty or over 1,000 characters.

### 7.5 Grocery lists and stores
- R19. A member creates a list with a name, then chooses its store.
- R20. Choosing a store: the person enters a 5-digit ZIP code; invalid ZIPs explain what is wrong; nearby stores list by distance with their address, hours and how many Clean Cart products they carry; the person chooses one.
- R21. On a list, each item shows whether the list's store carries it; items it doesn't carry offer the nearest store that does.
- R22. Items can be checked off, have their quantity changed and be removed; checked items move to the bottom; the list shows "6 of 14 done".
- R23. A list can be shared as a link and duplicated.

### 7.6 Across the app
- R24. One shared set of data: likes, saves, ratings, comments and lists made on one page show everywhere at once and stay after a reload.
- R25. Liking, saving, rating, commenting and lists ask a visitor to sign in first; the prototype's sign-in is one tap with a demo account.
- R26. Every page works with the keyboard, at 375px wide, and has designed loading, empty, no-results and error states.

## 8. Sample data

- 60 products across the 10 categories (4 to 8 each), real-sounding brands (e.g. "Sunrise Valley Organic Oats", "Hearth & Grain Sourdough", "Little Sprout Pear Puree"), a spread of ratings (3.2 to 4.9) and like counts.
- 12 stores across 3 ZIP areas (94110 San Francisco, 78704 Austin, 10025 New York): Green Valley Market, Harvest Co-op, Fresh Thyme, Whole Foods Market, Sprouts and others, each carrying 60% to 95% of the products.
- 40 ratings with comments across the most-liked products.
- Two grocery lists for the demo member: "Weekly shop" (14 items, Green Valley Market) and "Taco night" (6 items, Harvest Co-op).

Store data is sample data in this prototype. A real store directory or retailer API is for a later release.

## 9. Look

Fresh, calm and trustworthy, like a reference you rely on rather than a store: a warm off-white page, a leafy green accent with a soft citrus secondary, rounded
product photos, friendly display type for headings, clear certification badges, and plenty of white space around
products.

## 10. Not in this release

- Real store inventory (sample data only)
- Prices, buying, ordering, delivery and payments (Clean Cart is information only)
- Barcode scanning in the store
- Real accounts, passwords and email
- Moderation tools for comments
