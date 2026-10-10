/**
 * Layout: Settings, "tabs" version. Settings split into sections with a side list on wide screens and tabs on
 * phones. Good for apps with many settings (profile, appearance, notifications, privacy, data).
 *
 * To make it this app's own:
 *  1. Replace the sections and rows in SAMPLE with the settings the spec describes, and connect each control to the
 *     app's real state or storage. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete sections the spec doesn't need. A setting that does nothing yet must not be shown.
 *  3. Keep the building blocks and tokens. Change spacing or colors in src/styles/tokens.css, not here.
 */
import { useState } from "react";
import { Avatar, Button, Field, PageHeader, Section, SettingRow, SettingsList, Switch, Tabs } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Settings",
  description: "Your profile, how the app looks and what it remembers.",
  profile: { name: "Jordan Lee" },
  sections: [
    { id: "profile", label: "Profile" },
    { id: "appearance", label: "Appearance" },
    { id: "notifications", label: "Notifications" },
    { id: "data", label: "Your data" },
  ],
  notifications: [
    { id: "daily", label: "Daily reminder", description: "Once a day, while the app is open.", on: true },
    { id: "weekly", label: "Weekly summary", description: "What you did this week, every Monday.", on: false },
  ],
};

export default function SettingsScreen() {
  const data = SAMPLE;
  const [tab, setTab] = useState(data.sections[0].id);
  const [name, setName] = useState(data.profile.name);
  const [theme, setTheme] = useState("system");
  const [highContrast, setHighContrast] = useState(false);
  const [notify, setNotify] = useState<Record<string, boolean>>(Object.fromEntries(data.notifications.map((n) => [n.id, n.on])));

  return (
    <>
      <PageHeader title={data.title} description={data.description} />
      <Tabs label="Settings sections" tabs={data.sections} current={tab} onChange={setTab} orientation="vertical">
        {tab === "profile" ? (
          <Section title="Profile" description="How the app greets you.">
            <Avatar name={name} size="lg" />
            <Field label="Your name" hint="Shown only on this device.">
              {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            </Field>
          </Section>
        ) : null}
        {tab === "appearance" ? (
          <Section title="Appearance">
            <SettingsList>
              <SettingRow label="Theme" description="Match your device, or always use light or dark.">
                {(p) => (
                  <select {...p} className="ui-input" value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="system">Match device</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                )}
              </SettingRow>
              <SettingRow label="High contrast" description="Stronger colors and outlines for easier reading.">
                {(p) => <Switch {...p} checked={highContrast} onChange={setHighContrast} />}
              </SettingRow>
            </SettingsList>
          </Section>
        ) : null}
        {tab === "notifications" ? (
          <Section title="Notifications">
            <SettingsList>
              {data.notifications.map((n) => (
                <SettingRow key={n.id} label={n.label} description={n.description}>
                  {(p) => <Switch {...p} checked={notify[n.id] ?? false} onChange={(on) => setNotify((s) => ({ ...s, [n.id]: on }))} />}
                </SettingRow>
              ))}
            </SettingsList>
          </Section>
        ) : null}
        {tab === "data" ? (
          <Section title="Your data" description="Everything stays on this device.">
            <SettingsList>
              <SettingRow label="Save a backup" description="Download a file with all your data.">
                {(p) => <Button {...p}>Save backup</Button>}
              </SettingRow>
              <SettingRow label="Restore from a backup" description="Replace what's here with a saved backup file.">
                {(p) => <Button {...p}>Restore</Button>}
              </SettingRow>
            </SettingsList>
          </Section>
        ) : null}
      </Tabs>
    </>
  );
}
