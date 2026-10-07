/**
 * The starter's building blocks, rendered with realistic content. `npm run build:ui-gallery` turns this into
 * templates/ui-gallery.json (block → examples of real markup), which the Styles → Components view draws with each app's
 * own stylesheets. The previews then show actual buttons, tabs and cards in the app's surface style instead of class
 * names scraped from the code.
 */
import type { ReactElement } from "react";
import { ActionTile, ActivityList, Avatar, Badge, BarChart, Button, Card, Checklist, DataState, DataTable, EmptyState, Field, Grid, Hero, Notice, PageHeader, Progress, Section, SettingRow, SettingsList, Skeleton, Stat, Switch, Tabs, Trend } from "../../templates/react-vite-starter/src/components/ui";

const noop = () => undefined;
type Example = { label: string; el: ReactElement };

/** AppShell's header on its own (the full shell fills the window): the same classes AppShell renders. */
const TopNav = ({ actions }: { actions?: boolean }) => (
  <header className="ui-shell__header">
    <div className="ui-shell__brand">
      <span className="ui-shell__name">Planner</span>
      <span className="ui-shell__tagline">Your week, in one place</span>
    </div>
    <nav className="ui-shell__nav" aria-label="Main">
      <a className="ui-shell__link" href="#/calendar" aria-current="page">Calendar</a>
      <a className="ui-shell__link" href="#/tasks">Tasks</a>
      <a className="ui-shell__link" href="#/settings">Settings</a>
    </nav>
    {actions ? <div className="ui-shell__actions"><Button size="sm" variant="primary">New event</Button></div> : null}
  </header>
);

export const GALLERY: Record<string, Example[]> = {
  "ui-shell": [
    { label: "App bar", el: <TopNav /> },
    { label: "With an action", el: <TopNav actions /> },
  ],
  "ui-btn": [
    { label: "Primary", el: <Button variant="primary">Save changes</Button> },
    { label: "Secondary", el: <Button>Cancel</Button> },
    { label: "Ghost", el: <Button variant="ghost">More options</Button> },
    { label: "Danger", el: <Button variant="danger">Delete</Button> },
    { label: "Small", el: <Button size="sm">Small</Button> },
    { label: "Large", el: <Button variant="primary" size="lg">Get started</Button> },
    { label: "Disabled", el: <Button variant="primary" disabled>Saving…</Button> },
  ],
  "ui-card": [
    { label: "Card", el: <Card title="Weekly summary" footer={<Button size="sm">View all</Button>}><p>4 events this week, 2 of them today.</p></Card> },
    { label: "Interactive card", el: <Card title="Team planning" interactive><p>Thursday, 10:00 to 11:00</p></Card> },
  ],
  "ui-field": [
    { label: "Field", el: <Field label="Event title" hint="Shown on the calendar." required>{(p) => <input {...p} placeholder="Team standup" />}</Field> },
    { label: "With an error", el: <Field label="Email" error="Enter an email address like name@example.com.">{(p) => <input {...p} defaultValue="sam@" />}</Field> },
    { label: "Select", el: <Field label="Repeat">{(p) => <select {...p} defaultValue="weekly"><option value="none">Never</option><option value="weekly">Every week</option></select>}</Field> },
  ],
  "ui-badge": [
    { label: "Neutral", el: <Badge>Draft</Badge> },
    { label: "Accent", el: <Badge tone="accent">New</Badge> },
    { label: "Success", el: <Badge tone="success">Confirmed</Badge> },
    { label: "Danger", el: <Badge tone="danger">Cancelled</Badge> },
  ],
  "ui-notice": [
    { label: "Info", el: <Notice title="Heads up">Changes save automatically.</Notice> },
    { label: "Success", el: <Notice tone="success">Event created.</Notice> },
    { label: "Warning", el: <Notice tone="warning">This overlaps another event.</Notice> },
    { label: "Error", el: <Notice tone="error" title="Couldn't save">Check your connection and try again.</Notice> },
    { label: "Error with retry", el: <DataState error="Check your connection. Nothing you typed was lost." onRetry={() => undefined} /> },
  ],
  "ui-tabs": [
    { label: "Tabs", el: <Tabs label="Calendar view" tabs={[{ id: "m", label: "Month" }, { id: "w", label: "Week" }, { id: "d", label: "Day" }]} current="w" onChange={noop}><p>Week view</p></Tabs> },
    { label: "Vertical tabs", el: <Tabs label="Settings" orientation="vertical" tabs={[{ id: "g", label: "General" }, { id: "n", label: "Notifications" }, { id: "p", label: "Privacy" }]} current="g" onChange={noop}><p>General settings</p></Tabs> },
  ],
  "ui-switch": [
    { label: "On", el: <Switch checked onChange={noop} aria-label="Email reminders" /> },
    { label: "Off", el: <Switch checked={false} onChange={noop} aria-label="Weekly digest" /> },
  ],
  "ui-settings": [
    {
      label: "Settings list",
      el: (
        <SettingsList>
          <SettingRow label="Start week on Monday" description="Changes the first column of the month view.">{(p) => <Switch checked onChange={noop} {...p} />}</SettingRow>
          <SettingRow label="Show weekends">{(p) => <Switch checked={false} onChange={noop} {...p} />}</SettingRow>
        </SettingsList>
      ),
    },
  ],
  "ui-stat": [{ label: "Stat", el: <Stat label="Events this week" value="12" note="3 more than last week" /> }],
  "ui-trend": [
    { label: "Good", el: <Trend value={12} label="vs last week" /> },
    { label: "Bad", el: <Trend value={-8} label="vs last week" /> },
  ],
  "ui-progress": [{ label: "Progress", el: <Progress label="Profile set up" value={60} /> }],
  "ui-avatar": [
    { label: "Small", el: <Avatar name="Sam Lee" size="sm" /> },
    { label: "Medium", el: <Avatar name="Ana Ruiz" /> },
    { label: "Large", el: <Avatar name="Jo Park" size="lg" /> },
  ],
  "ui-empty": [
    { label: "Empty state", el: <EmptyState title="No events yet" message="Add your first event to see it on the calendar." action={<Button variant="primary">New event</Button>} /> },
    { label: "No results", el: <EmptyState title="No matches" message="Nothing matches your search. Try fewer words or clear the filters." action={<Button>Clear search</Button>} /> },
  ],
  "ui-skeleton": [
    { label: "Lines", el: <Skeleton lines={3} /> },
    { label: "Card", el: <Skeleton card /> },
  ],
  "ui-page-header": [{ label: "Page header", el: <PageHeader title="Calendar" description="Plan your week and keep track of what's next." action={<Button variant="primary">New event</Button>} /> }],
  "ui-section": [{ label: "Section", el: <Section title="Upcoming" description="The next seven days."><p>3 events</p></Section> }],
  "ui-checklist": [{ label: "Checklist", el: <Checklist label="Getting started" items={[{ id: "a", title: "Create an account", done: true }, { id: "b", title: "Add your first event", meta: "About a minute" }, { id: "c", title: "Invite your team" }]} /> }],
  "ui-activity": [{ label: "Activity", el: <ActivityList items={[{ id: "1", who: "Sam Lee", what: "moved Team planning to Thursday", when: "2 min ago" }, { id: "2", who: "Ana Ruiz", what: "added Design review", when: "1 hour ago" }]} /> }],
  "ui-table": [
    {
      label: "Table",
      el: (
        <DataTable
          caption="Upcoming events"
          rowKey={(r) => r.title}
          columns={[{ key: "title", header: "Event" }, { key: "when", header: "When" }, { key: "guests", header: "Guests", numeric: true }] as never}
          rows={[{ title: "Team standup", when: "Mon 09:00", guests: 6 }, { title: "Design review", when: "Wed 14:00", guests: 3 }]}
        />
      ),
    },
  ],
  "ui-chart": [{ label: "Bar chart", el: <BarChart title="Events per day" data={[{ label: "Mon", value: 4 }, { label: "Tue", value: 2 }, { label: "Wed", value: 5 }, { label: "Thu", value: 3 }, { label: "Fri", value: 1 }]} /> }],
  "ui-hero": [{ label: "Hero", el: <Hero eyebrow="Welcome back" title="Your week at a glance" description="Three events today, the first at 09:00." actions={<Button variant="primary">Open calendar</Button>} /> }],
  "ui-tile": [{ label: "Action tile", el: <ActionTile title="New event" description="Add something to your calendar." onClick={noop} /> }],
  "ui-grid": [{ label: "Stats grid", el: <Grid kind="stats"><Stat label="Today" value="3" /><Stat label="This week" value="12" /><Stat label="Overdue" value="0" /></Grid> }],
};
