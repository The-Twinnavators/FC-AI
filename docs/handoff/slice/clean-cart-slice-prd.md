# Clean Cart (slice): PRD

## 1. Summary

Clean Cart helps people find food made without GMOs and without bio-engineered ingredients. This slice covers one
journey only: from the home page, search for a product, open it, save it, and find it again on the Saved page.

## 2. Goals

- A shopper can find a product by name or brand in a few seconds.
- The product page says plainly why the product qualifies (its certification) and lists its ingredients.
- A shopper can save a product and come back to it later on the Saved page.

## 3. People

| Role | What they do |
|---|---|
| Member (signed in as a demo account) | Searches, opens products and saves them. |
| Visitor (not signed in) | Searches and opens products; saving asks them to sign in (one tap in the prototype). |

## 4. Main screens

| Screen | Purpose |
|---|---|
| Home | What Clean Cart is in one line, a search box, and a few featured products. |
| Search | Results for a search across product names and brands; a clear no-results message. |
| Product | One product: name, brand, category, certification, ingredients and a Save button. |
| Saved | The products the member saved, each opening its product page. |

## 5. Navigation

A top bar with the Clean Cart name and three links: Home, Search, Saved. A search result opens its Product page.

## 6. Records

### Products
- Name, brand, category, certification, ingredients, short description
- Which stores carry it

### Stores
- Name, ZIP code

## 7. Requirements

- R1: The Home page has a search box; submitting it shows the Search page with the results.
- R2: Search matches product names and brands, case-insensitively ("oat" finds "Oat Milk Original").
- R3: A search with no match says so and suggests trying another word.
- R4: The Product page shows the product's name, brand, category, certification and ingredients from its record.
- R5: The Product page has a Save button; a signed-in member's Save adds the product to Saved, and pressing it again removes it.
- R6: The Saved page lists the saved products by name and brand; each opens its Product page.
- R7: Saved products are still saved after the page is reloaded (kept in this browser).

## 8. Sample data

| Product | Brand | Category | Certification | Ingredients |
|---|---|---|---|---|
| Oat Milk Original | Willow Farms | Beverages | Non-GMO Project Verified | Oats, water, sea salt |
| Sourdough Country Loaf | Hearth & Grain | Bakery | USDA Organic | Wheat flour, water, salt, sourdough starter |
| Rolled Oats | Sunrise Valley | Breakfast | Non-GMO Project Verified | Whole grain rolled oats |
| Pear Puree | Little Sprout | Baby | USDA Organic | Organic pears |
| Black Bean Chips | Mesa Crunch | Snacks | Non-GMO Project Verified | Black beans, corn, sunflower oil, salt |
| Greek Yogurt Plain | Meadow Hill | Dairy | USDA Organic | Cultured pasteurized milk |

Stores (ZIP 94110, San Francisco): Green Valley Market, Harvest Co-op, Mission Fresh. Every product is carried by at
least one of them.

## 10. Not in this release

Comments, ratings, choosing a store by ZIP code, grocery lists, real accounts and payments.
