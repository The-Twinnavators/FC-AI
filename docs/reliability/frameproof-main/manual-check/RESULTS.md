# Manual browser check of FlowCode's preview (run paused, correction step blocked, lint failing)

Done on 2026-10-18 by browsing FlowCode's own preview (`http://127.0.0.1:65146/`) of the generated app. Nothing was selected, edited or stored. These results are not the automated acceptance suite, and the build is incomplete.

| # | Check | Result |
|---|---|---|
| 1 | Gallery: exactly the PRD's 12 photo records | **Pass** on the data: IDs, titles, categories and orientations match, with no extras or duplicates. **No images**: Image Source is empty for all 12, and Gallery is a paginated data table, not a photo grid. |
| 2 | "WINDOW" returns only Window Light | **Pass** (1 of 1) |
| 3 | "light" returns Window Light and Last Light | **Fail.** It returns 4 (Golden Hour and Soft Shadows too): search matches alt text, but R2 says titles only. |
| 4 | Outdoor 7, Studio 5 | **Pass.** The filter also offers a stray "All" option next to "Category: any". |
| 5 | Opening a photo shows the same record | **Pass** (Window Light, photo-02). The page is a record view with Edit: no image, no Add to selection, no notes field, no Previous/Next, and a generated "Note" that isn't from the PRD. |
| 6 | Returning to Gallery keeps search and filter | **Fail.** "Back to photos" resets the search and the category (R4). |

Console: no errors. No broken images, because no images are rendered.

**For later verification:**
- The search-scope failure (3) and the navigation-state failure (6) must be re-checked after any implementation step.
- Don't assume the downstream steps fix them. They are R2 and R4 requirements, and the plan's own tests for them were not checked against this behaviour.

Screenshots: `gallery.jpg` and `photo-detail-window-light.jpg`.
