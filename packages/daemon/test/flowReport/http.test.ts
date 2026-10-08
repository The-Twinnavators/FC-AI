// Repo Report over FlowCode's HTTP server: the contract the UI's api.ts was written against (paths, status codes,
// JSON shapes, PATCH/DELETE, CORS, the SSE progress stream), and the model rule that nothing leaves the machine
// unless the run's external research is on.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProviderConfig } from '@flowcode/contracts'
import { startServer, type ServerHandle } from '../../src/api/server.js'
import { routerModel, withModel, modelStatus } from '../../src/flowReport/comprehend/model.js'
import type { App } from '../../src/app.js'
import { makeApp, tmpDir, write } from '../helpers.js'

let app: App
let server: ServerHandle
let base: string
let repo: string

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${server.token}`, 'content-type': 'application/json', origin: 'http://localhost:5173' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, headers: res.headers, json: type.includes('json') ? await res.json() as any : null, res }
}

beforeAll(async () => {
  ;({ app } = makeApp())
  // No model is reachable, so a run measures and says it did not read: a test must not depend on Ollama.
  const ollama = app.router.providerConfigs().find((p) => p.id === 'ollama')!
  app.router.saveProvider({ ...ollama, baseUrl: 'http://127.0.0.1:9' })
  server = await startServer(app, { port: 0 })
  base = `http://127.0.0.1:${server.port}`
  repo = tmpDir('fr-http-repo-')
  write(repo, 'package.json', '{"name":"demo","scripts":{"build":"vite build"}}')
  write(repo, 'src/App.tsx', 'export default function App() { try { return null } catch (e) {} }\n')
  write(repo, 'index.html', '<!doctype html><html><head><title>Demo</title></head><body><div id="root"></div></body></html>')
})

afterAll(async () => {
  await server?.close()
})

describe('the Repo Report routes', () => {
  it('lists folders and roots', async () => {
    const b = await call('GET', `/flow-reports/browse?path=${encodeURIComponent(repo)}`)
    expect(b.status).toBe(200)
    expect(b.json).toMatchObject({ path: expect.any(String), entries: expect.any(Array) })
    expect(b.json.entries.map((e: any) => e.name)).toContain('src')
    const r = await call('GET', '/flow-reports/roots')
    expect(r.json.roots[0]).toMatchObject({ name: 'Home' })
  })

  it('allows PATCH and DELETE from the UI origin', async () => {
    const res = await fetch(base + '/flow-reports/projects', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } })
    expect(res.headers.get('access-control-allow-methods')).toMatch(/PATCH/)
    expect(res.headers.get('access-control-allow-methods')).toMatch(/DELETE/)
  })

  it('refuses a missing folder and a home folder with a sentence', async () => {
    expect((await call('POST', '/flow-reports/projects', {})).status).toBe(400)
    const home = await call('POST', '/flow-reports/projects', { repositoryPath: process.env.USERPROFILE ?? process.env.HOME })
    expect(home.status).toBe(400)
    expect(home.json.error).toMatch(/home folder/)
  })

  it('creates, runs, streams, downloads, patches and deletes', async () => {
    const created = await call('POST', '/flow-reports/projects', { repositoryPath: repo, name: 'Demo' })
    expect(created.status).toBe(201)
    const project = created.json.project
    expect(project.repositoryPath, 'the create answer carries no path').toBeUndefined()
    expect((await call('GET', '/flow-reports/projects')).json.projects[0].repositoryPath).toBeUndefined()
    expect((await call('GET', `/flow-reports/projects/${project.id}`)).json.project.repositoryPath).toBeTruthy()

    const patched = await call('PATCH', `/flow-reports/projects/${project.id}`, { settings: { tailoredWriting: false } })
    expect(patched.json).toEqual({ ok: true })

    const started = await call('POST', `/flow-reports/projects/${project.id}/runs`, {})
    expect(started.status).toBe(202)
    const runId = started.json.run.id
    expect((await call('POST', `/flow-reports/projects/${project.id}/runs`, {})).status).toBe(409)

    // The stream: current state first, then progress, closed when the run is terminal.
    const sse = await fetch(`${base}/flow-reports/runs/${runId}/events`, { headers: { authorization: `Bearer ${server.token}` } })
    expect(sse.headers.get('content-type')).toBe('text/event-stream')
    const text = await sse.text()
    const frames = text.split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => JSON.parse(f.slice(6)))
    expect(frames[0]).toMatchObject({ runId, projectId: project.id })
    expect(frames.at(-1).status).toMatch(/^completed/)

    const run = await call('GET', `/flow-reports/runs/${runId}`)
    expect(run.json.running).toBe(false)
    expect(run.json.run.comprehension.reason).toBeTruthy()
    expect((await call('GET', `/flow-reports/projects/${project.id}/runs`)).json.runs[0].id).toBe(runId)
    expect((await call('GET', `/flow-reports/runs/${runId}/log`)).json.events.length).toBeGreaterThan(0)

    const md = await call('GET', `/flow-reports/runs/${runId}/download/markdown`)
    expect(md.status).toBe(200)
    expect(md.headers.get('content-disposition')).toMatch(/demo-flowreport\.md/)
    expect(await md.res.text()).toMatch(/^# Demo — Repo Report/m)
    const section = run.json.run.artifacts.find((a: any) => a.format.startsWith('markdown:')).format
    expect((await call('GET', `/flow-reports/runs/${runId}/download/${encodeURIComponent(section)}`)).status).toBe(200)
    expect((await call('GET', `/flow-reports/runs/${runId}/download/nonsense`)).status).toBe(404)

    // A response on a finding, edited and removed by PATCH and DELETE.
    const s = run.json.run.sections.find((x: any) => x.findings.length > 0)
    if (s) {
      const f = s.findings[0]
      const r1 = await call('POST', `/flow-reports/runs/${runId}/responses`, { category: s.category, findingId: f.id, body: 'Fixed.', status: 'resolved' })
      const resp = r1.json.run.sections.find((x: any) => x.category === s.category).findings.find((x: any) => x.id === f.id).responses[0]
      expect((await call('PATCH', `/flow-reports/responses/${resp.id}?runId=${runId}`, { body: 'Fixed properly.' })).json.run.id).toBe(runId)
      expect((await call('DELETE', `/flow-reports/responses/${resp.id}?runId=${runId}`)).status).toBe(200)
      expect((await call('DELETE', `/flow-reports/responses/${resp.id}?runId=${runId}`)).status).toBe(404)
    }

    expect((await call('DELETE', `/flow-reports/runs/${runId}`)).json).toEqual({ ok: true })
    expect((await call('GET', `/flow-reports/runs/${runId}`)).status).toBe(404)
    expect((await call('DELETE', `/flow-reports/projects/${project.id}`)).json).toEqual({ ok: true })
    const gone = await call('GET', `/flow-reports/projects/${project.id}`)
    expect(gone.status).toBe(404)
    expect(gone.json).toEqual({ error: 'not found' })
  }, 120_000)
})

describe('the model a run reads through', () => {
  it('refuses a hosted model unless external research is on', async () => {
    const hosted = app.router.providerConfigs().find((p) => p.id === 'hosted-openai-compatible')! as ProviderConfig
    app.router.saveProvider({ ...hosted, enabled: true, baseUrl: 'http://127.0.0.1:9' })
    app.router.setRoleAssignment('repository_analyst', { providerId: hosted.id, model: 'some-hosted-model' })
    try {
      const off = await withModel(routerModel(app.router, { allowHosted: false }), () => modelStatus())
      expect(off.available).toBe(false)
      expect(off.reason).toMatch(/external research is off/)
      const on = await withModel(routerModel(app.router, { allowHosted: true }), () => modelStatus())
      expect(on.available).toBe(true)
      expect(on.models[0]).toMatch(/^some-hosted-model \(hosted/)
    } finally {
      app.router.setRoleAssignment('repository_analyst', { providerId: 'ollama', model: 'qwen3:14b', temperature: 0.1 })
      app.router.saveProvider({ ...hosted, enabled: false })
    }
  })

  it('says why when the assigned local model is not reachable, and never picks another', async () => {
    const s = await withModel(routerModel(app.router, { allowHosted: false }), () => modelStatus())
    expect(s.available).toBe(false)
    expect(s.reason).toMatch(/Ollama/)
  })
})
