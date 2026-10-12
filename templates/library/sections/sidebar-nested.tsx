/** @flowcode-library sidebar-nested · Nested sidebar with pins (Navigation)
 * Catalog ID: p.side-nav.nested (pattern)
 * Function: A ready-to-place nested sidebar (p.side-nav.nested) with projects, pages and pins.
 * Use it as: A ready-to-place p.side-nav.nested: copy sidebar-nested.tsx and replace SAMPLE (FlowCode brings the pattern file with it).
 * Built from: p.side-nav.nested
 * Look: A left sidebar with a Pinned list on top, then top pages and projects that open into their pages, each page pinnable.
 * Use cases: project navigation; documentation navigation; workspace tree; file tree; knowledge base; wiki; multi-project app
 * Jobs to be done: find a page inside a project; pin pages i use often; keep my open folders between visits; move between projects quickly
 * Keywords: sidebar, navigation, tree, nested, expandable, pinned, favorites, app shell, drawer, responsive
 */
/**
 * Sidebar: nested groups with pins. This is p.side-nav.nested with this piece's sample content; the implementation
 * lives in the pattern, in ./sidebar-nav-variants. Projects open into their pages (two levels) and any page can be
 * pinned to a "Pinned" list at the top. What is open and what is pinned are remembered. On phones it becomes a top bar
 * with a menu button that opens it as a drawer. Pass `main` to draw the screen beside it. Make it the app's own:
 * replace SAMPLE with the real projects and pages.
 */
import { SideNav } from "./sidebar-nav-variants";

// flowcode:sample
const SAMPLE = {
  title: "Kiln Room",
  mark: "K",
  top: [
    { id: "home", label: "Home", icon: "home" },
    { id: "inbox", label: "Inbox", icon: "inbox", count: 3 },
  ],
  projects: [
    {
      id: "spring",
      label: "Spring open studio",
      pages: [
        { id: "overview", label: "Overview" },
        { id: "schedule", label: "Schedule" },
        { id: "bookings", label: "Bookings" },
      ],
    },
    {
      id: "kiln",
      label: "Kiln repair",
      pages: [
        { id: "overview", label: "Overview" },
        { id: "tasks", label: "Tasks" },
        { id: "budget", label: "Budget" },
      ],
    },
    {
      id: "gallery",
      label: "Gallery night",
      pages: [
        { id: "overview", label: "Overview" },
        { id: "guests", label: "Guest list" },
        { id: "pieces", label: "Pieces" },
      ],
    },
  ],
  current: "spring/schedule",
  defaultOpen: ["projects", "spring"],
  defaultPins: ["spring/schedule"],
  storeKey: "fl-snv-nested",
};

export default function SidebarNested() {
  return <SideNav variant="nested" {...SAMPLE} />;
}
