/** @flowcode-library csv-import · CSV import (Forms)
 * Catalog ID: p.csv-import (pattern)
 * Function: The CSV import (p.csv-import): bring records in from a spreadsheet in three steps: pick, drop or paste a CSV (refused when it isn't CSV, is too big, empty or broken), match each column to a field (matched by name first; every required field must be matched once), then review every row with its problems marked, skip the bad ones and import with a progress bar and Cancel, ending in a summary.
 * Use it as: import { CsvImport } from "./csv-import"; <CsvImport entity="contacts" fields={[{ key, label, required?, kind?: "text"|"email"|"number"|"date", aliases?: ["e-mail"] }]} maxBytes?={2 * 1024 * 1024} maxRows?={5000} sample?={{ name: "contacts.csv", text }} onImport?={async (rows, progress, signal) => ...} onDone?={(summary) => ...} labels?={{ ... }} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.select.outlined, c.text-field.outlined, c.checkbox, c.segmented.segmented, c.badge.status
 * Look: A card with three numbered steps across the top and one sliding underline. Step one is a dashed drop zone with Choose file, Paste instead and Try a sample; step two a table of the file's columns, a sample value and an "Import as" dropdown; step three a count of rows ready and with problems, a filter and a table with the bad cells tinted; then a progress bar and a summary.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance
 * Use cases: import contacts; CSV upload; bulk import; spreadsheet import; import products; import customers; data migration; onboarding import
 * Jobs to be done: bring my existing list into the app; match my spreadsheet columns to the app's fields; see which rows have problems before importing; import only the rows that are right; know how many came in
 * Keywords: csv, import, upload, spreadsheet, columns, mapping, bulk, validation, progress, wizard
 */
/**
 * CSV import: a three-step importer. Upload takes a .csv file from the device (button or drag and drop) or pasted text,
 * and refuses files that are the wrong type, too big, empty or have an unclosed quote. Match columns pairs each column
 * with a field, guessing from the header names; Next checks that every required field is matched and none twice.
 * Review checks every row (required, email, number and date), tints the bad cells, filters to the problem rows and
 * offers to skip them; Import runs with a progress bar and Cancel, then sums up. Make it the app's own: set `fields` to
 * the record's fields and give onImport the real save (it gets the rows, a progress callback and an AbortSignal).
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its file uploaders, steps, tables and progress bars.
 */
/**
 * How to try it
 * - Press "Try a sample": the columns are matched for you. Set Email to "Don't import" and press Next: it says why.
 * - Put Email back, press Next: 3 rows have problems. Filter to Problems; untick "Skip" and Import is blocked.
 * - Press Import: the bar fills; press Cancel partway, or let it finish and read the summary. Start over.
 * - Press "Paste instead", paste a line with an unclosed quote ("Ana,Ruiz) and press Use text: it is refused.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button, Select, TextField, Checkbox,
 * Segmented and Badge ("./buttons-variants", "./dropdowns-states", "./text-fields-states", "./checkboxes-radios",
 * "./segmented-control", "./badges-status") and its inline icon set ("./icons"). Nothing else: no package to install,
 * nothing fetched, and the CSV is read in the browser. The styles are the library's own fl- classes in
 * templates/library/css/r2h-csvimport.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── p.csv-import: upload, match columns, review and import. ──

export type ImportField = { key: string; label: string; required?: boolean; kind?: "text" | "email" | "number" | "date"; aliases?: string[] };
export type ImportRow = Record<string, string>;
export type ImportSummary = { imported: number; skipped: number; canceled: boolean };

export type CsvImportLabels = Partial<{
  upload: string;
  map: string;
  review: string;
  drop: string;
  choose: string;
  paste: string;
  useText: string;
  sample: string;
  column: string;
  example: string;
  importAs: string;
  skip: string;
  next: string;
  back: string;
  startOver: string;
  importing: string;
  cancel: string;
}>;

export type CsvImportProps = {
  /** What the rows are, plural: "contacts". */
  entity: string;
  fields: ImportField[];
  maxBytes?: number;
  maxRows?: number;
  /** A file to try the importer with ("Try a sample"); hidden when left out. */
  sample?: { name: string; text: string };
  /** Saves the rows. Call progress(n) as rows land; stop when the signal aborts. Simulated when left out. */
  onImport?: (rows: ImportRow[], progress: (done: number) => void, signal: AbortSignal) => Promise<void>;
  onDone?: (summary: ImportSummary) => void;
  labels?: CsvImportLabels;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF, and a comma, semicolon or tab separator (guessed). */
export function parseCsv(text: string): { rows: string[][]; error?: string } {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) return { rows: [], error: "A quote is opened and never closed." };
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== "")) };
}

function problem(field: ImportField, value: string) {
  const v = value.trim();
  if (!v) return field.required ? "Required" : "";
  if (field.kind === "email" && !EMAIL.test(v)) return "Not an email";
  if (field.kind === "number" && !Number.isFinite(Number(v.replace(/[, ]/g, "")))) return "Not a number";
  if (field.kind === "date" && Number.isNaN(Date.parse(v))) return "Not a date";
  return "";
}

type Step = "upload" | "map" | "review" | "importing" | "done";
const STEPS: Step[] = ["upload", "map", "review"];

export function CsvImport({ entity, fields, maxBytes = 2 * 1024 * 1024, maxRows = 5000, sample, onImport, onDone, labels = {} }: CsvImportProps) {
  const l = {
    upload: "Upload",
    map: "Match columns",
    review: "Review",
    drop: "Drop a CSV file here",
    choose: "Choose file",
    paste: "Paste instead",
    useText: "Use text",
    sample: "Try a sample",
    column: "Column in your file",
    example: "Example",
    importAs: "Import as",
    skip: "Don't import",
    next: "Next",
    back: "Back",
    startOver: "Start over",
    importing: `Importing ${entity}…`,
    cancel: "Cancel",
    ...labels,
  };
  const id = useId();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [head, setHead] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [map, setMap] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [mapErrors, setMapErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [only, setOnly] = useState<"all" | "bad">("all");
  const [skipBad, setSkipBad] = useState(true);
  const [done, setDone] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const abort = useRef<AbortController | null>(null);
  const moved = useRef(false);

  // Each step change moves focus to the new step's heading, so the keyboard and screen reader start at the top.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);
  useEffect(() => () => abort.current?.abort(), []);

  const load = (name: string, text: string) => {
    setUploadError("");
    const { rows, error } = parseCsv(text);
    if (error) return setUploadError(`${name} couldn't be read: ${error}`);
    if (rows.length < 2) return setUploadError(`${name} has no rows under its header row.`);
    if (rows.length - 1 > maxRows) return setUploadError(`${name} has ${rows.length - 1} rows; the limit is ${maxRows}.`);
    const [h, ...rest] = rows;
    const width = h!.length;
    // Guess each column's field from its header: the label, the key or an alias; each field once.
    const used = new Set<string>();
    const guess = h!.map((col) => {
      const n = norm(col);
      const f = fields.find((x) => !used.has(x.key) && [x.label, x.key, ...(x.aliases ?? [])].some((a) => norm(a) === n));
      if (f) used.add(f.key);
      return f?.key ?? "";
    });
    setFileName(name);
    setHead(h!.map((c, i) => c.trim() || `Column ${i + 1}`));
    setBody(rest.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")));
    setMap(guess);
    setMapErrors([]);
    setOnly("all");
    setSkipBad(true);
    setPasting(false);
    setStep("map");
    setStatus(`${name}: ${rest.length} rows, ${used.size} of ${h!.length} columns matched.`);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) return setUploadError(`${file.name} isn't a CSV file.`);
    if (file.size > maxBytes) return setUploadError(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${(maxBytes / 1048576).toFixed(0)} MB.`);
    if (file.size === 0) return setUploadError(`${file.name} is empty.`);
    try {
      load(file.name, await file.text());
    } catch {
      setUploadError(`${file.name} couldn't be read.`);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    readFile(e.dataTransfer.files[0]);
  };

  const checkMap = () => {
    const errs: string[] = [];
    for (const f of fields.filter((x) => x.required)) if (!map.includes(f.key)) errs.push(`Match a column to ${f.label}.`);
    for (const f of fields) if (map.filter((k) => k === f.key).length > 1) errs.push(`${f.label} is matched to more than one column.`);
    setMapErrors(errs);
    if (errs.length) {
      setStatus(errs.join(" "));
      return;
    }
    setStep("review");
  };

  // Rows as records, with their problems by field key.
  const checked = useMemo(
    () =>
      body.map((r, i) => {
        const rec: ImportRow = {};
        map.forEach((k, c) => k && (rec[k] = r[c]!.trim()));
        const issues: Record<string, string> = {};
        for (const f of fields) {
          const p = problem(f, rec[f.key] ?? "");
          if (p) issues[f.key] = p;
        }
        return { n: i + 2, rec, issues, bad: Object.keys(issues).length > 0 };
      }),
    [body, map, fields],
  );
  const bad = checked.filter((r) => r.bad).length;
  const good = checked.length - bad;
  const mapped = fields.filter((f) => map.includes(f.key));
  const visible = only === "bad" ? checked.filter((r) => r.bad) : checked;
  const toImport = skipBad ? checked.filter((r) => !r.bad) : checked;
  const blocked = !skipBad && bad > 0;

  const run = async () => {
    const rows = toImport.map((r) => r.rec);
    const ctrl = new AbortController();
    abort.current = ctrl;
    setDone(0);
    setStep("importing");
    setStatus(l.importing);
    let count = 0;
    const progress = (n: number) => {
      count = n;
      setDone(n);
    };
    try {
      if (onImport) await onImport(rows, progress, ctrl.signal);
      else
        for (let i = 0; i < rows.length && !ctrl.signal.aborted; i += 4) {
          await new Promise((r) => window.setTimeout(r, 90));
          if (!ctrl.signal.aborted) progress(Math.min(rows.length, i + 4));
        }
    } catch {
      /* A failed save ends like a cancel: what landed is counted. */
    }
    const s = { imported: count, skipped: checked.length - count, canceled: ctrl.signal.aborted };
    setSummary(s);
    setStep("done");
    setStatus(s.canceled ? `Import canceled. ${s.imported} ${entity} imported.` : `${s.imported} ${entity} imported.`);
    onDone?.(s);
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHead([]);
    setBody([]);
    setMap([]);
    setSummary(null);
    setUploadError("");
    setPasted("");
  };

  const at = step === "importing" || step === "done" ? 2 : STEPS.indexOf(step);
  const stepTitle = step === "upload" ? `Import ${entity} from a CSV file` : step === "map" ? `Match the columns in ${fileName}` : step === "review" ? `Review ${checked.length} rows` : step === "importing" ? l.importing : summary?.canceled ? "Import canceled" : "Import finished";

  return (
    <section className="fl-ci" aria-labelledby={`${id}-h`} data-fl="p.csv-import">
      <ol className="fl-ci-steps" style={{ ["--at" as string]: at }}>
        {[l.upload, l.map, l.review].map((s, i) => (
          <li key={s} className={i < at || step === "done" ? "is-done" : i === at ? "is-current" : undefined} aria-current={i === at && step !== "done" ? "step" : undefined}>
            <span className="fl-ci-dot" aria-hidden="true">
              {i < at || step === "done" ? <Icon name="check" /> : i + 1}
            </span>
            <span>{s}</span>
            {i < at || step === "done" ? <span className="fl-sr">, done</span> : null}
          </li>
        ))}
        <span className="fl-ci-rail" aria-hidden="true" />
      </ol>

      <div className="fl-ci-card" key={step}>
        <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="fl-ci-title">
          {stepTitle}
        </h2>

        {step === "upload" ? (
          <>
            <div
              className={`fl-ci-drop${over ? " is-over" : ""}${uploadError ? " is-error" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <Icon name="upload" />
              <strong>{l.drop}</strong>
              <span>
                CSV, up to {(maxBytes / 1048576).toFixed(0)} MB and {maxRows.toLocaleString()} rows. The first row names the columns.
              </span>
              <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="fl-sr" tabIndex={-1} aria-hidden="true" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="fl-ci-drop-actions">
                <Button size={40} icon="folder" onClick={() => fileInput.current?.click()}>
                  {l.choose}
                </Button>
                <Button variant="secondary" size={40} pressed={pasting} aria-expanded={pasting} aria-controls={`${id}-paste`} onClick={() => setPasting((p) => !p)}>
                  {l.paste}
                </Button>
                {sample ? (
                  <Button variant="tertiary" size={40} onClick={() => load(sample.name, sample.text)}>
                    {l.sample}
                  </Button>
                ) : null}
              </div>
            </div>
            <div id={`${id}-paste`} className={`fl-ci-paste${pasting ? " is-open" : ""}`} inert={!pasting || undefined}>
              <div className="fl-ci-paste-inner">
                <label htmlFor={`${id}-text`}>Paste CSV text</label>
                <TextField id={`${id}-text`} multiline rows={5} value={pasted} placeholder={"First name,Last name,Email\nAna,Ruiz,ana@example.com"} onChange={(e) => setPasted(e.target.value)} className="fl-ci-mono" />
                <div>
                  <Button variant="secondary" size={32} disabled={!pasted.trim()} onClick={() => load("Pasted text", pasted)}>
                    {l.useText}
                  </Button>
                </div>
              </div>
            </div>
            {uploadError ? (
              <p className="fl-ci-error" role="alert">
                <Icon name="alert" />
                {uploadError}
              </p>
            ) : null}
          </>
        ) : null}

        {step === "map" ? (
          <>
            <p className="fl-ci-lede">
              {body.length} rows. Fields marked * must be matched. Columns set to "{l.skip}" are left out.
            </p>
            <div className="fl-ci-scroll">
              <table className="fl-ci-table fl-ci-maptable">
                <thead>
                  <tr>
                    <th scope="col">{l.column}</th>
                    <th scope="col">{l.example}</th>
                    <th scope="col">{l.importAs}</th>
                  </tr>
                </thead>
                <tbody>
                  {head.map((h, c) => {
                    const clash = map[c] && map.filter((k) => k === map[c]).length > 1;
                    return (
                      <tr key={c}>
                        <th scope="row" data-label={l.column}>
                          {h}
                        </th>
                        <td data-label={l.example} className="fl-ci-muted">
                          {body.find((r) => r[c]?.trim())?.[c] ?? "—"}
                        </td>
                        <td data-label={l.importAs}>
                          <Select
                            aria-label={`${l.importAs}: ${h}`}
                            value={map[c] ?? ""}
                            invalid={Boolean(clash)}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMap((m) => m.map((k, i) => (i === c ? v : k)));
                              setMapErrors([]);
                            }}
                            options={[{ value: "", label: l.skip }, ...fields.map((f) => ({ value: f.key, label: `${f.label}${f.required ? " *" : ""}` }))]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {mapErrors.length ? (
              <ul className="fl-ci-errors" role="alert">
                {mapErrors.map((e) => (
                  <li key={e}>
                    <Icon name="alert" />
                    {e}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="fl-ci-nav">
              <Button variant="secondary" size={40} icon="chevron-left" onClick={() => setStep("upload")}>
                {l.back}
              </Button>
              <Button size={40} icon="chevron-right" iconAt="end" onClick={checkMap}>
                {l.next}
              </Button>
            </div>
          </>
        ) : null}

        {step === "review" ? (
          <>
            <div className="fl-ci-counts">
              <Badge tone="success" led>
                {good} ready
              </Badge>
              {bad ? (
                <Badge tone="warning" led>
                  {bad} with problems
                </Badge>
              ) : null}
              {bad ? (
                <Segmented
                  size="sm"
                  label="Show rows"
                  value={only}
                  onChange={(v) => setOnly(v as "all" | "bad")}
                  options={[
                    { value: "all", label: "All" },
                    { value: "bad", label: "Problems" },
                  ]}
                />
              ) : null}
            </div>
            <div className="fl-ci-scroll fl-ci-scroll--tall" tabIndex={0} role="region" aria-label="Rows to import">
              <table className="fl-ci-table fl-ci-rows">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    {mapped.map((f) => (
                      <th key={f.key} scope="col">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, 200).map((r) => (
                    <tr key={r.n} className={r.bad ? "is-bad" : undefined}>
                      <th scope="row">{r.n}</th>
                      {mapped.map((f) => (
                        <td key={f.key} className={r.issues[f.key] ? "is-bad" : undefined}>
                          {r.rec[f.key] || <span className="fl-ci-muted">—</span>}
                          {r.issues[f.key] ? <span className="fl-ci-issue">{r.issues[f.key]}</span> : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible.length > 200 ? <p className="fl-ci-muted fl-ci-small">Showing the first 200 of {visible.length} rows.</p> : null}
            {bad ? (
              <Checkbox label={`Skip the ${bad} rows with problems`} description="Fix them in your file and import them later." checked={skipBad} onChange={(e) => setSkipBad(e.target.checked)} aria-describedby={blocked ? `${id}-blocked` : undefined} />
            ) : null}
            {blocked ? (
              <p id={`${id}-blocked`} className="fl-ci-error" role="alert">
                <Icon name="alert" />
                Rows with problems can't be imported. Skip them or fix the file.
              </p>
            ) : null}
            <div className="fl-ci-nav">
              <Button variant="secondary" size={40} icon="chevron-left" onClick={() => setStep("map")}>
                {l.back}
              </Button>
              <Button size={40} icon="upload" disabled={blocked || toImport.length === 0} onClick={run}>
                {`Import ${toImport.length} ${entity}`}
              </Button>
            </div>
          </>
        ) : null}

        {step === "importing" ? (
          <div className="fl-ci-run">
            <span className="fl-ci-bar" role="progressbar" aria-label={l.importing} aria-valuemin={0} aria-valuemax={toImport.length} aria-valuenow={done} aria-valuetext={`${done} of ${toImport.length}`}>
              <span style={{ scale: `${toImport.length ? done / toImport.length : 0} 1` }} />
            </span>
            <p className="fl-ci-muted">
              {done} of {toImport.length} {entity}
            </p>
            <div>
              <Button variant="secondary" size={40} onClick={() => abort.current?.abort()}>
                {l.cancel}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "done" && summary ? (
          <div className="fl-ci-done">
            <span className={`fl-ci-doneicon${summary.canceled ? " is-warn" : ""}`} aria-hidden="true">
              <Icon name={summary.canceled ? "alert" : "check"} />
            </span>
            <p>
              <strong>
                {summary.imported} {entity} imported
              </strong>
              {summary.skipped ? `, ${summary.skipped} not imported` : ""}.
            </p>
            <Button variant="secondary" size={40} icon="refresh" onClick={reset}>
              {l.startOver}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  entity: "contacts",
  fields: [
    { key: "first", label: "First name", required: true, aliases: ["given name", "firstname"] },
    { key: "last", label: "Last name", aliases: ["surname", "family name"] },
    { key: "email", label: "Email", required: true, kind: "email", aliases: ["e-mail", "email address"] },
    { key: "company", label: "Company", aliases: ["organization", "org"] },
    { key: "phone", label: "Phone", aliases: ["mobile", "tel"] },
    { key: "since", label: "Customer since", kind: "date", aliases: ["signed up", "created"] },
  ] as ImportField[],
  sample: {
    name: "contacts-oct.csv",
    text: [
      "Given name,Surname,E-mail,Organization,Mobile,Signed up,Notes",
      "Ana,Ruiz,ana@harborpine.com,Harbor & Pine,(206) 555-0148,2025-03-14,Prefers email",
      "Marcus,Lee,marcus@lee.design,Lee Design,(416) 555-0102,2024-11-02,",
      "Priya,Shah,priya.shah@example,Shah Studio,(512) 555-0199,2026-01-20,Check address",
      "Tom,Becker,tom@clientco.com,ClientCo,,2025-07-08,",
      'Sam,"O\'Neil, Jr.",sam@oneil.co,"O\'Neil, Sons & Co",(503) 555-0110,2023-05-30,Quoted name',
      ",Hart,lena@hart.io,Hart Labs,,2026-02-11,No first name",
      "Dana,Whitfield,dana@harborpine.com,Harbor & Pine,(206) 555-0175,last spring,",
      "Kofi,Mensah,kofi@mensah.africa,Mensah Coffee,+233 20 555 0133,2025-09-01,",
      "Lucia,Moreno,lucia@moreno.es,,,2026-06-17,",
      "Henrik,Berg,henrik@berg.no,Berg AS,+47 555 01 234,2024-02-29,",
    ].join("\n"),
  },
};

export default function CsvImportSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Import contacts">
      <div className="fl-wrap fl-wrap--narrow">
        <CsvImport {...SAMPLE} />
      </div>
    </section>
  );
}
