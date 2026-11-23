// A small client for Annex's HTTP API: everything these examples need, and
// nothing else. No packages; Node 20 or later.
//
// It reads ANNEX_API_KEY (and ANNEX_URL, ANNEX_WORKSPACE), or what `annex login`
// saved in ~/.config/annex/config.json.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

let saved = {}
try { saved = JSON.parse(readFileSync(`${homedir()}/.config/annex/config.json`, 'utf8')) } catch {}
const base = (process.env.ANNEX_URL || saved.url || 'https://annex.eversonder.com').replace(/\/$/, '')
const key = process.env.ANNEX_API_KEY || saved.api_key
if (!key) {
  console.error('No Annex key. Run `annex login`, or set ANNEX_API_KEY (dashboard, API keys).')
  process.exit(1)
}

export class AnnexError extends Error {
  constructor(status, body) {
    super(body?.message || `Annex answered ${status}`)
    this.status = status
    this.code = body?.code
  }
}

// call sends one request. body may be an object (sent as JSON) or bytes.
export async function call(method, path, body, headers = {}) {
  const bytes = body instanceof Uint8Array || typeof body === 'string'
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': bytes ? 'application/octet-stream' : 'application/json', ...headers },
    body: body === undefined ? (method === 'GET' ? undefined : '{}') : bytes ? body : JSON.stringify(body),
  })
  if (!res.ok) throw new AnnexError(res.status, await res.json().catch(() => null))
  if (res.status === 204) return null
  return res.headers.get('content-type')?.includes('json') ? res.json() : Buffer.from(await res.arrayBuffer())
}

let workspace = process.env.ANNEX_WORKSPACE || saved.workspace
async function ws() {
  workspace ||= (await call('GET', '/v1/key')).key.workspace
  return `/v1/workspaces/${workspace}`
}
const q = (path) => `?path=${encodeURIComponent(path)}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const annex = {
  base,
  // start a sandbox: { template, route, vcpu, memory_gib, task, secret_groups, … }
  async start(input = {}) {
    return (await call('POST', `${await ws()}/sandboxes`, input, { 'Idempotency-Key': randomUUID() })).sandbox
  },
  async get(id) { return (await call('GET', `${await ws()}/sandboxes/${id}`)).sandbox },
  async pause(id) { return (await call('POST', `${await ws()}/sandboxes/${id}/pause`)).sandbox },
  async resume(id) { return (await call('POST', `${await ws()}/sandboxes/${id}/resume`)).sandbox },
  async stop(id) { return (await call('POST', `${await ws()}/sandboxes/${id}/stop`)).sandbox },

  // ready waits for a template's set-up to finish (a sandbox takes no command until then).
  // A set-up that fails stops the sandbox and throws.
  async ready(id) {
    for (;;) {
      const sb = await this.get(id)
      if (sb.setup?.state === 'failed') {
        await this.stop(id).catch(() => {}) // never leave a half-made sandbox running
        throw new Error(`set-up failed: ${sb.setup.note}`)
      }
      if (sb.setup?.state !== 'running') return sb
      await sleep(2000)
    }
  },

  // run a shell command to its end: { exit_code, output, status }.
  async run(id, command, { cwd, env, timeout = 600 } = {}) {
    const path = `${await ws()}/sandboxes/${id}/commands`
    let { command: c } = await call('POST', `${path}?wait=60`, { command, cwd, env, timeout_seconds: timeout })
    if (c.status !== 'running' && !c.truncated) return c
    while (c.status === 'running') {
      await sleep(2000)
      c = (await call('GET', `${path}/${c.id}`)).command
    }
    let output = '', cursor = ''
    for (;;) { // the whole output, a page at a time
      const page = await call('GET', `${path}/${c.id}/output?perPage=100&cursor=${encodeURIComponent(cursor)}`)
      output += page.output.map((o) => o.text).join('')
      if (page.meta.done || !page.output.length) break
      cursor = page.meta.next_cursor
    }
    return { ...c, output }
  },

  async upload(id, path, bytes) { await call('PUT', `${await ws()}/sandboxes/${id}/files/content${q(path)}`, bytes) },
  async download(id, path) { return call('GET', `${await ws()}/sandboxes/${id}/files/content${q(path)}`) },
  async files(id, path) { return (await call('GET', `${await ws()}/sandboxes/${id}/files${q(path)}`)).files },

  // A task's shared queue and key-value store (every sandbox has a task; pass `task` to start() to share one).
  async push(task, queue, body) { await call('POST', `${await ws()}/tasks/${task}/queues/${queue}/messages`, { body }) },
  async kv(task, prefix = '') {
    const out = []
    for (let page = 1; ; page++) {
      const r = await call('GET', `${await ws()}/tasks/${task}/kv?prefix=${encodeURIComponent(prefix)}&page=${page}&perPage=100`)
      out.push(...r.kv)
      if (r.kv.length < 100) return out
    }
  },
}
