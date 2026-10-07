/**
 * FlowReport's client (after FlowAgent's Flow Reports): the daemon routes under /flow-reports, their JSON shapes, and
 * the shared vocabulary (labels, severity order, score bands). Every route and shape here matches FlowAgent's, so the
 * daemon port can be checked against this file line by line.
 *
 * The repository path comes back on one route only (GET /flow-reports/projects/:id), for the project page to show; the
 * list and every export carry the display name and repository-relative paths, so a screenshot or a report never gives
 * away the folder layout.
 *
 * FlowCode's own `api()` speaks GET and POST; FlowReport also needs PATCH, DELETE and file downloads, so requests go
 * through `call()` below with the same base URL and bearer token (`conn`).
 */
import { ApiError, conn } from "../api";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";

export interface Evidence {
  kind: string;
  path?: string;
  lineStart?: number;
  lineEnd?: number;
  description: string;
}

export interface ClaudeCodePrompt {
  title: string;
  prompt: string;
  intendedOutcome: string;
}

/** The plain reading of a finding, for someone who won't be fixing it. */
export interface PlainLanguage {
  what: string;
  soWhat: string;
  ifIgnored: string;
}

export interface FindingResponse {
  id: string;
  body: string;
  /** Typed here, or read out of a document. An edit never turns one into the other. */
  source: "typed" | "imported";
  sourceName: string | null;
  createdAt: string;
  createdBy: string | null;
  editedAt: string | null;
  editedBy: string | null;
}

export interface Finding {
  id: string;
  category: string;
  title: string;
  summary: string;
  severity: Severity;
  confidence: Confidence;
  status: string;
  impact: string;
  recommendation: string;
  rationale: string;
  evidence: Evidence[];
  claudeCodePrompts: ClaudeCodePrompt[];
  limitations?: string[];
  requiresManualValidation?: boolean;
  // Derived by the daemon on the way out (optional: an older daemon won't send them).
  /** The decision recorded against this finding, carried across scans of the same repository. A decision with no
   *  response against it doesn't close the finding: the page asks for the account that was never given. */
  resolution?: {
    status: string;
    reason: string;
    titleWhenResolved: string;
    resolvedAt: string;
    resolvedBy: string | null;
    lastEditedAt: string | null;
    lastEditedBy: string | null;
    /** True when the finding's wording has moved since the reason was written. */
    titleChanged?: boolean;
  };
  /** Every account of what was done about this finding, oldest first. */
  responses?: FindingResponse[];
  plain?: PlainLanguage;
  /** The same finding written for this product by the local model. Prose only: it can't change severity or evidence. */
  tailored?: { title: string; whatItMeans: string; whyItMatters: string; whatToDo: string[] };
  /** True when `plain` is the section's general reading rather than one written for this finding. */
  genericReading?: boolean;
  steps?: string[];
}

export interface ReportSection {
  category: string;
  status: string;
  /** Null is a real answer ("insufficient evidence"), never shown as 0. */
  score: number | null;
  summary: string;
  findings: Finding[];
  limitations: string[];
  reason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ReportSummary {
  overallScore: number | null;
  scoreExplanation: string;
  narrative: string;
  severityCounts: Record<Severity, number>;
  priorities: string[];
  quickWins: string[];
  longerTerm: string[];
  couldNotVerify: string[];
  filesScanned: number;
  filesSkipped: number;
  /** What a person closed by hand, and the figure the scan itself produced. Absent until something is marked. */
  resolved?: { count: number; scoreAsMeasured: number | null };
}

export type FindingStatus = "open" | "noted" | "accepted_risk" | "resolved" | "not_applicable";

export interface ReportArtifact {
  /** `markdown` and `pdf` are the whole report; `markdown:seo` etc. one domain. A `pdf:<domain>` appears once asked for. */
  format: "markdown" | "pdf" | `markdown:${string}` | `pdf:${string}`;
  filename: string;
  storageReference: string;
  bytes: number;
  sha256: string;
  createdAt: string;
}

export interface FlowReportRun {
  id: string;
  projectId: string;
  status: string;
  progress: number;
  currentStage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  analysisVersion: string;
  summary: ReportSummary | null;
  sections: ReportSection[];
  warnings: Array<{ stage: string; message: string; category?: string }>;
  errors: Array<{ stage: string; message: string; category?: string }>;
  artifacts: ReportArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSettings {
  depth: "quick" | "standard" | "deep";
  includeTests: boolean;
  includeDocs: boolean;
  includeDependencyManifests: boolean;
  excludeGenerated: boolean;
  customIgnore: string[];
  networkResearch: boolean;
  tailoredWriting: boolean;
}

export interface FlowReportProject {
  id: string;
  name: string;
  repositoryDisplayName: string;
  /** Where the folder is. Only on getProject, never on the list, and never in an export. */
  repositoryPath?: string;
  settings: AnalysisSettings;
  latestRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressEvent {
  runId: string;
  projectId: string;
  status?: string;
  progress?: number;
  currentStage?: string;
  section?: { category: string; status: string };
}

export interface RunLogEvent {
  id: number;
  runId: string;
  level: "info" | "warn" | "error";
  stage: string | null;
  message: string;
  createdAt: string;
}

// ── Transport ────────────────────────────────────────────────────────────────

/** Sends a request with the daemon's token. A daemon error keeps the daemon's own sentence: it's written to be read. */
async function call(path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${conn.base}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${conn.token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "The FlowCode daemon isn't reachable. FlowReport runs inside it, so nothing here works until it's running.");
  }
  if (!res.ok) {
    let message = `The daemon returned ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: unknown } | null;
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* not JSON; keep the status */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

const json = async <T,>(path: string, init?: Parameters<typeof call>[1]): Promise<T> => (await call(path, init)).json() as Promise<T>;

// ── Choosing a folder (the folder browser calls these) ───────────────────────

export const BROWSE_ROUTES = { browse: "/flow-reports/browse", roots: "/flow-reports/roots" } as const;

// ── Projects ─────────────────────────────────────────────────────────────────

export const listProjects = async (): Promise<FlowReportProject[]> => (await json<{ projects: FlowReportProject[] }>("/flow-reports/projects")).projects;

/** One project, including `repositoryPath`. The list deliberately leaves it out. */
export const getProject = async (id: string): Promise<FlowReportProject> => (await json<{ project: FlowReportProject }>(`/flow-reports/projects/${id}`)).project;

export const createProject = async (input: { name?: string; repositoryPath: string; settings?: Partial<AnalysisSettings> }): Promise<FlowReportProject> =>
  (await json<{ project: FlowReportProject }>("/flow-reports/projects", { method: "POST", body: input })).project;

export const updateProject = (id: string, patch: { name?: string; settings?: AnalysisSettings }) => json<{ ok: true }>(`/flow-reports/projects/${id}`, { method: "PATCH", body: patch });

export const deleteProject = (id: string) => json<{ ok: true }>(`/flow-reports/projects/${id}`, { method: "DELETE" });

// ── Runs ─────────────────────────────────────────────────────────────────────

export const listRuns = async (projectId: string): Promise<FlowReportRun[]> => (await json<{ runs: FlowReportRun[] }>(`/flow-reports/projects/${projectId}/runs`)).runs;

export const startRun = async (projectId: string, settings?: AnalysisSettings): Promise<FlowReportRun> =>
  (await json<{ run: FlowReportRun }>(`/flow-reports/projects/${projectId}/runs`, { method: "POST", body: settings ? { settings } : {} })).run;

export const getRun = (runId: string) => json<{ run: FlowReportRun; running: boolean }>(`/flow-reports/runs/${runId}`);

export const cancelRun = (runId: string) => json<{ ok: true }>(`/flow-reports/runs/${runId}/cancel`, { method: "POST", body: {} });

/** Remove a run. The daemon refuses one that's still going and allows any that has finished. */
export const deleteRun = (runId: string) => json<{ ok: true }>(`/flow-reports/runs/${runId}`, { method: "DELETE" });

/** A run that has stopped, however it ended, and so can be removed. */
export const isDeletableRun = (r: FlowReportRun): boolean => TERMINAL.has(r.status);

/** A run that finished and produced nothing: no report to lose. */
export const isEmptyRun = (r: FlowReportRun): boolean => TERMINAL.has(r.status) && !r.summary;

/**
 * Mark a finding resolved, or put it back. Returns the whole run, because a decision moves the section score, the
 * overall score and the counts; the daemon recomputes them and the page replaces what it shows.
 */
export const setFindingStatus = (runId: string, category: string, findingId: string, status: FindingStatus, reason?: string) =>
  json<{ run: FlowReportRun; running: boolean }>(`/flow-reports/runs/${runId}/findings/status`, { method: "POST", body: { category, findingId, status, reason } });

// ── Responses (accounts of what was done; each survives a rescan) ─────────────

/** Add an account of what was done, and settle the status with it when one is given. */
export const addResponse = (runId: string, category: string, findingId: string, body: string, status?: FindingStatus) =>
  json<{ run: FlowReportRun; running: boolean }>(`/flow-reports/runs/${runId}/responses`, { method: "POST", body: { category, findingId, body, status } });

export const editResponse = (responseId: string, runId: string, body: string) =>
  json<{ run: FlowReportRun | null }>(`/flow-reports/responses/${responseId}?runId=${encodeURIComponent(runId)}`, { method: "PATCH", body: { body } });

/** Removing the last response on a closed finding reopens it and moves the score, so the recomputed run comes back. */
export const deleteResponse = (responseId: string, runId: string) =>
  json<{ run: FlowReportRun | null }>(`/flow-reports/responses/${responseId}?runId=${encodeURIComponent(runId)}`, { method: "DELETE" });

// ── Importing a response document ────────────────────────────────────────────

export interface ProposedResponse {
  category: string;
  findingId: string;
  findingTitle: string;
  body: string;
  status: FindingStatus;
  /** The exact words the status was read from, so the preview shows its work. */
  verdictText: string;
  verdictRule: string;
  categoryMismatch?: { documentSection: string; actual: string };
}

export interface ImportPreview {
  documentTitle: string | null;
  proposals: ProposedResponse[];
  unmatched: string[];
  unanswered: number;
}

/** Say what a document would change. Writes nothing. The file is read in the browser and sent as text. */
export const previewResponses = async (runId: string, text: string): Promise<ImportPreview> =>
  (await json<{ preview: ImportPreview }>(`/flow-reports/runs/${runId}/responses/preview`, { method: "POST", body: { text } })).preview;

/** Write the rows that survived the preview, in one go. */
export const applyResponses = (runId: string, sourceName: string, rows: ProposedResponse[]) =>
  json<{ run: FlowReportRun; applied: number }>(`/flow-reports/runs/${runId}/responses/apply`, {
    method: "POST",
    body: { sourceName, rows: rows.map((r) => ({ category: r.category, findingId: r.findingId, body: r.body, status: r.status })) },
  });

export const runLog = async (runId: string): Promise<RunLogEvent[]> => (await json<{ events: RunLogEvent[] }>(`/flow-reports/runs/${runId}/log`)).events;

/**
 * Follow a run's progress over the daemon's event stream (GET /flow-reports/runs/:id/events, text/event-stream).
 * Returns a function that closes it. The first event describes the run as it is on connecting, so a page opened
 * halfway through isn't staring at an empty bar.
 *
 * Read with fetch rather than EventSource so the token goes in a header, not the URL, and so any frame works: with or
 * without an `event:` name, and with the progress object either bare or wrapped in `{ data: … }`. If the daemon's
 * stream changes shape, this is the one function to change. The page polls alongside it, so a dead stream only slows
 * things down.
 */
export function subscribeRun(runId: string, onEvent: (e: ProgressEvent) => void): () => void {
  const ctrl = new AbortController();
  void (async () => {
    try {
      const res = await fetch(`${conn.base}/flow-reports/runs/${runId}/events`, {
        headers: { authorization: `Bearer ${conn.token}`, accept: "text/event-stream" },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).replace(/^ /, ""))
            .join("\n");
          if (!data) continue;
          try {
            const raw = JSON.parse(data) as ProgressEvent & { data?: ProgressEvent };
            const e = raw.runId ? raw : raw.data;
            if (e?.runId) onEvent(e);
          } catch {
            /* a malformed frame; the next one or the poll covers it */
          }
        }
      }
    } catch {
      /* aborted, or the daemon went away; the poll covers it */
    }
  })();
  return () => ctrl.abort();
}

/**
 * Fetch an artifact (GET /flow-reports/runs/:id/download/:format) and hand it to the browser as a download. The blob
 * URL is revoked later rather than at once: revoking it in the same tick can produce an empty file.
 */
export async function downloadArtifact(runId: string, format: string, filename: string): Promise<void> {
  const res = await call(`/flow-reports/runs/${runId}/download/${encodeURIComponent(format)}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ── Shared vocabulary ────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<string, string> = {
  error_log: "Error log & reports",
  product_intel: "Product intel",
  engineering_quality: "Engineering quality",
  monetization: "Monetization",
  seo: "SEO & link previews",
  marketplace_health: "Marketplace health",
  role_journeys: "Role journeys",
  accessibility: "Accessibility",
  competitive_gaps: "Competitive gaps",
  compliance: "Compliance",
  security_qa: "Security QA",
  marketing_opportunity: "Marketing opportunity scan",
  data_architecture: "Data architecture",
  cross_domain: "Cross-domain synthesis",
  action_plan: "Action plan",
};

/** The sections, in report order. A copy of the daemon's list (which decides what runs): keep the two in step, or a
 *  new section runs and never shows in the progress checklist. */
export const REPORT_CATEGORIES = Object.keys(CATEGORY_LABEL);

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  preparing: "Preparing",
  scanning: "Scanning",
  analyzing: "Analyzing",
  generating: "Generating",
  completed: "Completed",
  completed_with_warnings: "Completed with warnings",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Pending",
  in_progress: "Running",
  not_applicable: "Not applicable",
  skipped: "Skipped",
  noted: "Response on record",
  accepted_risk: "Risk accepted",
};

export const TERMINAL = new Set(["completed", "completed_with_warnings", "failed", "cancelled"]);

export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Informational" };

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/**
 * Severity colours are CSS classes (flowreport.css: .fr-sev--critical … .fr-sev--info), so they follow the theme and
 * match the rest of FlowCode: red, orange, amber, teal, then neutral for informational (a note, not a lesser problem).
 * Confidence is never coloured: two colour scales and nobody can tell which one means urgent.
 */
export const sevClass = (s: Severity) => `fr-sev--${s}`;

/**
 * Score bands: words as well as colour, because a colour alone isn't a reading anyone can quote. The middle band is
 * deliberately neutral: "workable" is neither good news nor a problem. `tone` is a .fr-tone--* class.
 */
export function scoreBand(score: number | null): { word: string; tone: "none" | "ok" | "fair" | "warn" | "bad" } {
  if (score === null) return { word: "Insufficient evidence", tone: "none" };
  if (score >= 80) return { word: "Healthy", tone: "ok" };
  if (score >= 60) return { word: "Workable", tone: "fair" };
  if (score >= 40) return { word: "Needs work", tone: "warn" };
  return { word: "Poor", tone: "bad" };
}
