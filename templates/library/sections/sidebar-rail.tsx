/** @flowcode-library sidebar-rail · Icon rail and panel (Navigation)
 * Catalog ID: p.side-nav.rail (pattern)
 * Function: A ready-to-place icon-rail sidebar (p.side-nav.rail) for apps with a few big sections.
 * Use it as: A ready-to-place p.side-nav.rail: copy sidebar-rail.tsx and replace SAMPLE (FlowCode brings the pattern file with it).
 * Built from: p.side-nav.rail
 * Look: A slim rail of section icons beside a panel listing the chosen section's pages, becoming a phone drawer.
 * Use cases: email app; chat app; messaging; file browser; workspace navigation; help desk; notes app; app navigation
 * Jobs to be done: switch between sections of the app; open a conversation or folder; find a page within a section; keep my place while browsing
 * Keywords: sidebar, navigation, icon rail, secondary panel, inbox, app shell, tooltips, drawer, responsive
 */
/**
 * Sidebar: icon rail with a secondary panel, like an email or chat app. This is p.side-nav.rail with this piece's
 * sample content; the implementation lives in the pattern, in ./sidebar-nav-variants. A slim rail of section icons
 * (names show as tooltips) sits next to a wider panel listing the pages of the chosen section. On phones it becomes a
 * top bar with a menu button that opens both as a drawer. Pass `main` to draw the screen beside it. Make it the app's
 * own: replace SAMPLE with the real sections and their pages.
 */
import { SideNav } from "./sidebar-nav-variants";

// flowcode:sample
const SAMPLE = {
  title: "Kiln Room",
  mark: "K",
  person: { initials: "AR", name: "Ada Reyes" },
  sections: [
    {
      id: "inbox",
      label: "Inbox",
      icon: "inbox",
      text: "Messages from clients and the team.",
      pages: [
        { id: "all", label: "All messages", count: 12 },
        { id: "unread", label: "Unread", count: 3 },
        { id: "starred", label: "Starred" },
        { id: "archived", label: "Archived" },
      ],
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "calendar",
      text: "Classes, workshops and kiln firings.",
      pages: [
        { id: "today", label: "Today", count: 6 },
        { id: "week", label: "This week", count: 21 },
        { id: "firings", label: "Kiln firings", count: 2 },
      ],
    },
    {
      id: "clients",
      label: "Clients",
      icon: "users",
      text: "Everyone who books with you.",
      pages: [
        { id: "everyone", label: "Everyone", count: 214 },
        { id: "members", label: "Members", count: 31 },
        { id: "waitlist", label: "Waiting list", count: 7 },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      icon: "chart",
      text: "How the studio is doing.",
      pages: [
        { id: "income", label: "Income" },
        { id: "seats", label: "Seats filled" },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: "gear",
      text: "Studio details, team and billing.",
      pages: [
        { id: "studio", label: "Studio" },
        { id: "team", label: "Team" },
        { id: "billing", label: "Billing" },
      ],
    },
  ],
};

export default function SidebarRail() {
  return <SideNav variant="rail" {...SAMPLE} />;
}
