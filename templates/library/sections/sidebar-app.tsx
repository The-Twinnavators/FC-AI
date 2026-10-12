/** @flowcode-library sidebar-app · App sidebar (Navigation)
 * Catalog ID: p.side-nav.app (pattern)
 * Function: A ready-to-place app-shell sidebar (p.side-nav.app) with search, groups, main action and account menu.
 * Use it as: A ready-to-place p.side-nav.app: copy sidebar-app.tsx and replace SAMPLE (FlowCode brings the pattern file with it).
 * Built from: p.side-nav.app
 * Look: A left sidebar with the product mark, a search field, grouped pages with count badges, a primary button and the signed-in person, folding to icons and to a phone drawer.
 * Use cases: app navigation; dashboard layout; admin panel; booking app; crm; project management app; saas app shell; back office
 * Jobs to be done: move between sections of the app; find a page quickly; create a new item from anywhere; manage my account and sign out
 * Keywords: sidebar, navigation, app shell, dashboard, collapsible, search, account menu, drawer, responsive
 */
/**
 * Sidebar: the classic app sidebar. This is p.side-nav.app with this piece's sample content; the implementation lives
 * in the pattern, in ./sidebar-nav-variants. Product name at the top, a search box that filters the pages, grouped
 * pages with icons and counts, one primary "New booking" button and the signed-in person with a small menu at the
 * bottom. It collapses to icons only and remembers that choice; on phones it becomes a top bar with a drawer. Pass
 * `main` to draw the screen beside it. Make it the app's own: replace SAMPLE with the real pages, groups and person.
 */
import { SideNav } from "./sidebar-nav-variants";

// flowcode:sample
const SAMPLE = {
  title: "Kiln Room",
  mark: "K",
  current: "bookings",
  groups: [
    {
      id: "workspace",
      label: "Workspace",
      items: [
        { id: "home", label: "Home", icon: "home", count: 0 },
        { id: "bookings", label: "Bookings", icon: "calendar", count: 4 },
        { id: "clients", label: "Clients", icon: "users", count: 0 },
        { id: "reports", label: "Reports", icon: "chart", count: 0 },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "team", label: "Team", icon: "team", count: 0 },
        { id: "billing", label: "Billing", icon: "card", count: 0 },
      ],
    },
  ],
  action: { id: "new", label: "New booking" },
  person: { initials: "AR", name: "Ada Reyes", email: "ada@kilnroom.example" },
  menu: [
    { id: "profile", label: "Profile", icon: "user" },
    { id: "sign-out", label: "Sign out", icon: "out", danger: true },
  ],
  storeKey: "fl-snv-app-collapsed",
};

export default function SidebarApp() {
  return <SideNav variant="app" {...SAMPLE} />;
}
