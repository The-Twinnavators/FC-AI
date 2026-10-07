/**
 * Layout: Settings, "grouped" version. One page of settings in titled groups, each row saying what it does, with
 * the risky actions (reset, delete) last and clearly separated. Good for apps with a handful of settings.
 *
 * To make it this app's own:
 *  1. Replace the groups and rows in SAMPLE with the settings the spec describes, and connect each control to the
 *     app's real state or storage. Remove the "flowcode:sample" comment when nothing sample is left.
 *  2. Delete groups the spec doesn't need. A setting that does nothing yet must not be shown.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { useState } from "react";
import { Button, Dialog, Notice, PageHeader, Section, SettingRow, SettingsList, Switch } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  title: "Settings",
  description: "Choose how the app looks and behaves. Changes save automatically.",
  appearance: { theme: "system", textSize: "medium" },
  toggles: [
    { id: "reminders", label: "Daily reminder", description: "A gentle nudge once a day while the app is open.", on: true },
    { id: "sounds", label: "Sounds", description: "Play a short sound when you finish something.", on: false },
    { id: "motion", label: "Reduce motion", description: "Turn off animations and moving effects.", on: false },
  ],
};

export default function SettingsScreen() {
  const data = SAMPLE;
  const [theme, setTheme] = useState(data.appearance.theme);
  const [textSize, setTextSize] = useState(data.appearance.textSize);
  const [toggles, setToggles] = useState<Record<string, boolean>>(Object.fromEntries(data.toggles.map((t) => [t.id, t.on])));
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState("");

  return (
    <>
      <PageHeader title={data.title} description={data.description} />

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
          <SettingRow label="Text size" description="Make all text larger or smaller.">
            {(p) => (
              <select {...p} className="ui-input" value={textSize} onChange={(e) => setTextSize(e.target.value)}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            )}
          </SettingRow>
        </SettingsList>
      </Section>

      <Section title="Notifications and sounds">
        <SettingsList>
          {data.toggles.map((t) => (
            <SettingRow key={t.id} label={t.label} description={t.description}>
              {(p) => <Switch {...p} checked={toggles[t.id] ?? false} onChange={(on) => setToggles((s) => ({ ...s, [t.id]: on }))} />}
            </SettingRow>
          ))}
        </SettingsList>
      </Section>

      <Section title="Your data" description="Everything stays on this device. Save a copy to move it or keep it safe.">
        <SettingsList>
          <SettingRow label="Save a backup" description="Download a file with all your data.">
            {(p) => (
              <Button {...p} onClick={() => setSaved("Backup saved to your downloads.")}>
                Save backup
              </Button>
            )}
          </SettingRow>
          <SettingRow label="Reset the app" description="Remove all your data from this device. This can't be undone.">
            {(p) => (
              <Button {...p} variant="danger" onClick={() => setConfirmReset(true)}>
                Reset
              </Button>
            )}
          </SettingRow>
        </SettingsList>
        {saved ? <Notice tone="success">{saved}</Notice> : null}
      </Section>

      <Dialog
        open={confirmReset}
        title="Reset the app?"
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <Button onClick={() => setConfirmReset(false)}>Keep my data</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(false);
                setSaved("All data was removed from this device.");
              }}
            >
              Remove everything
            </Button>
          </>
        }
      >
        <p>This removes all your data from this device. Save a backup first if you might want it later.</p>
      </Dialog>
    </>
  );
}
