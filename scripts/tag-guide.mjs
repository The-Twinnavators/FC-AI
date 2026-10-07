// One-off codemod: adds data-guide anchors (used by the Copilot spotlight) and mounts the Copilot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "ui", "src");
const edit = (file, pairs) => {
  const p = path.join(src, file);
  let s = fs.readFileSync(p, "utf8");
  for (const [from, to] of pairs) {
    if (s.includes(to)) continue; // idempotent
    if (!s.includes(from)) throw new Error(`${file}: anchor not found: ${from.slice(0, 70)}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(p, s);
};

edit("App.tsx", [
  ['import { NetworkView } from "./views/NetworkView";', 'import { NetworkView } from "./views/NetworkView";\nimport { Copilot } from "./components/Copilot";'],
  ['      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">', '      <Copilot route={route.path} projectId={projectId} runId={runId} />\n      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">'],
  ['<button key={n.path} className="rail__item"', '<button key={n.path} data-guide={`nav.${n.path === "/" ? "projects" : n.path.slice(1)}`} className="rail__item"'],
  ['<button className="rail__item" aria-label="System"', '<button data-guide="nav.system" className="rail__item" aria-label="System"'],
  ['<button className="rail__item" aria-label="Settings"', '<button data-guide="nav.settings" className="rail__item" aria-label="Settings"'],
  ['          className="topbar__search"', '          className="topbar__search"\n          data-guide="topbar.search"'],
  ['<button className="provider-pill" onClick={() => navigate("/models")}', '<button data-guide="topbar.provider" className="provider-pill" onClick={() => navigate("/models")}'],
  ['<button className="provider-pill" onClick={() => navigate(projectId ?', '<button data-guide="topbar.approvals" className="provider-pill" onClick={() => navigate(projectId ?'],
]);
edit("components/NewBuild.tsx", [
  ['      className="section reveal"\n      aria-labelledby="newbuild-title"', '      className="section reveal"\n      data-guide="newbuild.form"\n      aria-labelledby="newbuild-title"'],
  ['        <div className="field">\n          <label className="label" htmlFor="nb-desc">', '        <div className="field" data-guide="newbuild.description">\n          <label className="label" htmlFor="nb-desc">'],
  ['        <div className="field">\n          <span className="label">Spec files (optional)</span>', '        <div className="field" data-guide="newbuild.files">\n          <span className="label">Spec files (optional)</span>'],
  ['        <div className="field">\n          <span className="label">Autonomy</span>', '        <div className="field" data-guide="newbuild.autonomy">\n          <span className="label">Autonomy</span>'],
]);
edit("views/ProjectsView.tsx", [['<section className="section reveal" aria-labelledby="projects-heading"', '<section className="section reveal" data-guide="projects.list" aria-labelledby="projects-heading"']]);
edit("views/WorkspaceView.tsx", [
  ['<section className="ws__col" aria-label="Files and knowledge">', '<section className="ws__col" data-guide="ws.files" aria-label="Files and knowledge">'],
  ['<section className="ws__col" aria-label="Task, plan and work">', '<section className="ws__col" data-guide="ws.work" aria-label="Task, plan and work">'],
  ['<section className="ws__col ws__col--right" aria-label=', '<section className="ws__col ws__col--right" data-guide="ws.tabs" aria-label='],
  ['<ol className="task-list" aria-label="Tasks">', '<ol className="task-list" data-guide="ws.tasks" aria-label="Tasks">'],
  ['    <div style={{ padding: "12px", borderTop: "1px solid var(--line)", display: "grid", gap: 8 }}>', '    <div data-guide="ws.preflight" style={{ padding: "12px", borderTop: "1px solid var(--line)", display: "grid", gap: 8 }}>'],
]);
edit("components/SignalStrip.tsx", [
  ['<footer className="strip" aria-label=', '<footer className="strip" data-guide="ws.strip" aria-label='],
  ['<div className="strip__controls">{controls}</div>', '<div className="strip__controls" data-guide="ws.controls">{controls}</div>'],
]);
edit("views/ModelsView.tsx", [
  ['      <section className="section">\n        <div className="section__head">\n          <h2 className="section__title">Coder capability lab</h2>', '      <section className="section" data-guide="models.lab">\n        <div className="section__head">\n          <h2 className="section__title">Coder capability lab</h2>'],
  ['      <section className="section">\n        <div className="section__head">\n          <h2 className="section__title">Role assignments</h2>', '      <section className="section" data-guide="models.roles">\n        <div className="section__head">\n          <h2 className="section__title">Role assignments</h2>'],
]);
edit("views/SystemView.tsx", [
  ['        <section className="section">\n          <div className="section__head">\n            <h2 className="section__title">Daemon controls</h2>', '        <section className="section" data-guide="system.controls">\n          <div className="section__head">\n            <h2 className="section__title">Daemon controls</h2>'],
  ['      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>\n        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>', '      <div data-guide="system.health" style={{ display: "grid", gap: 12, alignContent: "start" }}>\n        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>'],
  ['      <div className="section">\n        <Tabs\n          label="system"', '      <div className="section" data-guide="system.tabs">\n        <Tabs\n          label="system"'],
]);
edit("views/SettingsView.tsx", [['              <div className="field">\n                <span className="label">Autonomy level</span>', '              <div className="field" data-guide="settings.autonomy">\n                <span className="label">Autonomy level</span>']]);
edit("views/NetworkView.tsx", [
  ['<div ref={host} className="network__canvas" aria-hidden="true" />', '<div ref={host} className="network__canvas" data-guide="network.canvas" aria-hidden="true" />'],
  ['<aside className="network__panel"', '<aside data-guide="network.panel" className="network__panel"'],
]);
edit("views/AgentsView.tsx", [
  ['        <div className="agents-stage">', '        <div className="agents-stage" data-guide="agents.map">'],
  ['<section aria-label="Agent pipeline" className="pipeline">', '<section aria-label="Agent pipeline" className="pipeline" data-guide="agents.pipeline">'],
]);
edit("views/KnowledgeView.tsx", [
  ['        role="search"\n        className="section"', '        role="search"\n        className="section"\n        data-guide="knowledge.search"'],
  ['    <section className="section">\n      <div className="section__head">\n        <h2 className="section__title">Research</h2>', '    <section className="section" data-guide="knowledge.research">\n      <div className="section__head">\n        <h2 className="section__title">Research</h2>'],
]);
edit("views/ReportsView.tsx", [['          <div style={{ display: "flex", gap: 8 }}>\n            <button className="btn" disabled={!!busy', '          <div style={{ display: "flex", gap: 8 }} data-guide="reports.export">\n            <button className="btn" disabled={!!busy']]);
edit("views/QualityView.tsx", [['<button className="btn btn--primary" disabled={!projectId || busy} onClick={run}>', '<button className="btn btn--primary" data-guide="quality.run" disabled={!projectId || busy} onClick={run}>']]);
console.log("guide anchors added");
