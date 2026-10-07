/**
 * FlowReport (after FlowAgent's Flow Reports): one place for repository reports, replacing Build analysis and
 * Compliance report. #/flowreport lists your report projects; #/flowreport/<projectId> opens one.
 */
import { FlowReportsPage } from "./FlowReportsPage";
import { FlowReportProjectPage } from "./FlowReportProjectPage";
import "../styles/flowreport.css";

export function FlowReportView({ projectId }: { projectId?: string }) {
  return projectId ? <FlowReportProjectPage key={projectId} projectId={projectId} /> : <FlowReportsPage />;
}
