/**
 * Data process → Skill pipeline: how skills flow into builds over time (library changes, which skills agents picked,
 * the steps that ran with them, and whether checks passed). A view of how FlowCode works, beside Agents and the
 * Network Graph; it used to be a tab in Prompts & Skills, where every other tab is a list you manage.
 */
import { LibraryOverview } from "../components/LibraryOverview";

export function PipelineView() {
  return (
    <div className="page page-enter">
      <header className="page__head">
        <div>
          <span className="label">Data process</span>
          <h1 className="page__title">Skill pipeline</h1>
          <p className="lrc__meta">
            How skills flow into your builds: what changed in the library, which skills agents picked, the steps that ran with them, and whether their checks passed. Live from your FlowCode builds. The skills themselves are in{" "}
            <a href="#/library?tab=skills">Prompts &amp; Skills</a>.
          </p>
        </div>
      </header>
      <section className="library-pipeline pipeline-page">
        <LibraryOverview embedded />
      </section>
    </div>
  );
}
