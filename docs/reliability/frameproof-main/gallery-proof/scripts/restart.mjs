// The restart step of the activation (backups and build already done): one System → Restart, then check.
const API = "http://127.0.0.1:7457";
const H = { authorization: "Bearer dev-token-flowcode" };
const RUN = "run_b789650d36dd4323aa4b";
const get = async (p) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${API}${p}`, { headers: H });
      return { status: r.status, body: r.status === 200 ? await r.json() : await r.text() };
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
};
const states = (b) => b.tasks.map((t) => `${t.id}:${t.status}:${t.attempts}`).join("\n");
const before = await get(`/runs/${RUN}`);
if (before.body.active) throw new Error("run active");
const sys0 = await get("/system");
try {
  await fetch(`${API}/system/restart`, { method: "POST", headers: H });
} catch (e) {
  console.log("restart request closed by the exiting daemon:", e.cause?.code ?? e.message);
}
let sys;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    sys = await get("/system");
    if (sys.body?.pid && sys.body.pid !== sys0.body.pid) break;
  } catch {}
}
const steps = await get(`/runs/${RUN}/run-steps`);
const after = await get(`/runs/${RUN}`);
console.log(JSON.stringify({ pidBefore: sys0.body.pid, pidAfter: sys?.body?.pid, uptimeS: Math.round((sys?.body?.uptimeMs ?? 0) / 1000), runStepsEndpoint: steps.status, run: after.body.run.status, active: after.body.active, tasksUnchanged: states(before.body) === states(after.body) }));
