# Treaty Tables: PRD

Pilot PRD for FlowCode's Complete app mode, written from the treaty-prototype-v2 reference. It describes the same
product so the build can be compared with the reference screen by screen.

## 1. Summary

Treaty Tables is the part of ATLAS, an annuity reinsurance administration system, where a reinsurance operations team
keeps every treaty table configured for a client. A treaty table records how an insurer (the cedent) passes part of its
annuity risk to one or more reinsurers: the layers and retention, the allowances it is paid, the tax and collateral
position of each reinsurer, and which processing cycles include it. Today this lives in spreadsheets and email; mistakes
surface months later as wrong settlements.

The prototype must feel like the real internal tool: the whole navigation is visible, the Treaty Tables area works end to
end with realistic data, and every other area is clearly marked as not in this prototype.

## 2. Goals

- An operations analyst finds any treaty and understands its terms in under a minute.
- A new treaty is onboarded in one guided flow, saved as a draft at any point, and never bound without approval.
- A manager sees what is waiting on them, ordered by how much is at stake, and approves or returns each item with a reason.
- Nobody approves their own work, and every change is kept in an audit trail.

## 3. People

| Role | What they do |
|---|---|
| Reinsurance Ops (analyst, "Write" access) | Searches treaties, onboards new ones, amends active ones, answers feed exceptions. Cannot approve. |
| Manager (Reinsurance Manager) | Reviews drafts and amendments, approves or sends them back with a reason, binds treaties into the next cycle. |
| Viewer (actuarial, audit) | Reads treaties, versions and the audit trail. Changes nothing. |

The prototype lets the person switch the role they act as ("View as") to see each role's actions.

## 4. Main screens

| Screen | Purpose |
|---|---|
| Home | Where the treaty book stands: active treaties, placed capacity, what needs attention, the last cycle run, recent activity. |
| Treaty Master | Every treaty table for this client: search, filter, sort, export, open one, create one. |
| New treaty | The onboarding wizard for a new treaty table, from the paperwork to binding. |
| Treaty detail | One treaty: its terms, layers, allowances, compliance, cycles and its audit history, with the actions the role allows. |
| Approvals and exceptions | The manager's queue of drafts and amendments waiting on a decision, ordered by materiality and time left. |
| Reinsurer registry | Each assuming reinsurer with its domicile, tax form status, withholding rate and collateral position. |

## 5. Navigation

A left rail with the whole product, grouped:

- Overview: Home
- Treaty Tables: Treaty Master, New treaty, Layer and retention, Allowance tables, Reinsurer registry, Tax and compliance, Approvals and exceptions
- Reinsurance: Reinsurance record, Annuity coverages, Annuity master, Annuity transactions, Annuitant search, Cycle messages, Roll forward, Snapshot, History
- Support tables: Calculation configuration, Rate tables, Run order
- Utilities: Batch scheduler, Bulk operations, Feed exceptions
- Reports: Bordereau reporting, Audit trail
- Claims: Claim search
- Admin: Users and roles, Client setup

Only the screens in section 4 are built. Every other destination opens a page that says it is not in this prototype.
The top bar shows breadcrumbs, the environment ("DEV · Cycle 2026-07 open"), a Go to… search, the role switcher,
notifications and the signed-in person.

## 6. Treaty records

A treaty table has:

- Treaty name and treaty code (TRTY-YYYY-…, matching the signed slip), both required
- Relationship: ceded, assumed or retrocession
- Cedent company (Acme Mutual Life & Annuity Co., Beacon Heritage Insurance Corp., Pinnacle Financial Assurance Group, Northgate Life)
- Lead reinsurer (Munich Reinsurance America, Swiss Re Life & Health America, Hannover Re SE, RGA Reinsurance Company, SCOR Global Life)
- Line of business: fixed deferred annuity (MYGA), fixed indexed annuity, variable annuity with GMxB riders, single premium immediate annuity, longevity swap
- Treaty type: coinsurance quota share, modified coinsurance (Modco), funds withheld coinsurance, YRT, excess of loss
- Effective date and expiry or anniversary
- Currency (USD, CAD, EUR, GBP)
- Placed limit and cedent retention per life, in dollars
- Ceded share (quota share percent, 0 to 100)
- First-year ceding commission, percent
- Accounting basis (statutory, GAAP, both) and cycle frequency (monthly, quarterly, annual)
- Notes for the approver

Statuses, in order: Draft → Awaiting approval → Active → Expiring soon → Runoff. A returned draft goes back to Draft
with the manager's reason.

## 7. Requirements

### 7.1 Treaty Master

- R1. The list shows treaty name and code, counterparty, carrier, type, effective date, placed limit, retention and status.
- R2. Summary tiles above the list show active treaties, placed capacity in force, and how many need attention.
- R3. Tabs filter by status with a count on each: all, active, awaiting approval, drafts, runoff.
- R4. People search by name or code, filter by product line, carrier and status, and clear all filters at once.
- R5. Columns sort; the list pages with a choice of rows per page; "Showing 1–8 of 27" is always visible.
- R6. Export downloads the filtered list as CSV.
- R7. Each row opens its treaty; a row menu offers the status changes the current role may make.

### 7.2 New treaty (onboarding wizard)

- R8. The wizard has steps: General terms, Layers and retention, Allowances, Compliance and tax, Review and bind.
- R9. Each step shows how complete it is and whether it has problems; required fields are checked when leaving a step.
- R10. A readiness panel lists everything still blocking submission; each item jumps to its field.
- R11. The draft saves at any point ("Draft saved 12:04 PM"), can be discarded with confirmation, and is listed as a Draft.
- R12. The review step shows every term grouped by step with an Edit link back to that step.
- R13. Submitting sends the treaty for approval; it appears in the manager's queue immediately and opens on its detail page.

### 7.3 Treaty detail

- R14. The header shows the treaty name, code, status, cedent, line, type, effective date and version.
- R15. Key figures: placed limit, retention per life, ceded share, first-year commission.
- R16. Tabs: Summary (terms grouped as in the wizard, editable in place with validation) and Activity (who did what, when, with reasons).
- R17. The actions shown depend on the role: Ops submit drafts and amend; Managers approve or send back (a reason is required) and put active treaties into runoff (reason required). Actions the role can't take are shown disabled with the reason.
- R18. A Draft opens back into the wizard to continue.

### 7.4 Approvals and exceptions

- R19. Managers see treaties awaiting approval first, with counts of what is waiting, the value under review and how many breach the service level today.
- R20. Approving or sending back from the queue updates the treaty, the counts, Home and the notifications at once.
- R21. A preparer cannot approve their own treaty.

### 7.5 Home

- R22. Tiles: active treaty tables, placed capacity in force, needs attention, last cycle run.
- R23. A "needs attention" list opens each waiting treaty; a breakdown shows treaties by status and by line.
- R24. Recent activity lists the latest approvals, submissions and edits from the whole app.

### 7.6 Reinsurer registry

- R25. Each reinsurer shows its domicile, W-8BEN-E validity, withholding rate, credit for reinsurance and status (cleared, renew W-8, collateral required).
- R26. A reinsurer whose W-8 expires within 90 days is flagged and counted on Home under "needs attention".

### 7.7 Across the app

- R27. One shared set of data: a change on any page shows on every other page without reloading.
- R28. Switching the role changes the actions offered everywhere.
- R29. Notifications show recent changes; the bell shows how many are new.
- R30. Every page works with the keyboard, at 375px wide, and has designed empty and no-match states.

## 8. Sample data

27 treaty tables across four cedents and five reinsurers, 2020 to 2026, with a spread of statuses (about 10 active, 9
awaiting approval, 3 drafts, 3 expiring soon, 3 in runoff), placed limits from $25M to $250M, and realistic names such as
"2025 MYGA Quota Share", "VA GMDB Excess of Loss" and "2024 Fixed Coinsurance". Six reinsurers in the registry, one with a
W-8 expiring on 30 Sep 2026.

## 9. Look

A calm, dense operations tool: warm off-white surfaces, deep green for the product and primary actions, serif display
type for page titles, small caps group labels in the rail, tabular figures in tables, status chips toned by meaning.

## 10. Not in this release

- Document upload and AI extraction of the placement slip
- The calculation engine, rate tables, run order and cycle processing
- Version comparison, the signed revision chain and evidence export
- Bulk operations, migrations and feed exception replay
- Claims, annuity records and bordereau reporting
- Copilot and comment threads
