// Every user of your product gets a computer of their own. It is started the
// first time they need it, paused when they go quiet, and resumed, files and
// all, when they come back.
//
//   node server.mjs      then open http://localhost:3000 in two browsers, as two users
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { annex, AnnexError } from '../lib/annex.mjs'

const IDLE_MS = 5 * 60 * 1000 // pause a user's sandbox after this long without a command
const DB = new URL('./users.json', import.meta.url) // user -> sandbox id; a real product keeps this in its own records
let users = {}
try { users = JSON.parse(readFileSync(DB, 'utf8')) } catch {}
const save = () => writeFileSync(DB, JSON.stringify(users, null, 2))
const lastUsed = new Map()

// sandboxFor is the user's running sandbox: resumed if it was paused, started if they never had one
// (or if the one they had is gone).
async function sandboxFor(user) {
  const id = users[user]
  if (id) {
    try {
      const sb = await annex.get(id)
      if (sb.status === 'running') return id
      if (sb.status === 'paused') return (await annex.resume(id)).id
    } catch (err) {
      if (!(err instanceof AnnexError && err.status === 404)) throw err
    }
  }
  const sb = await annex.start({ route: 'cheapest', vcpu: 1, memory_gib: 1 })
  await annex.ready(sb.id)
  users[user] = sb.id
  save()
  return sb.id
}

setInterval(async () => {
  for (const [user, at] of lastUsed) {
    if (Date.now() - at < IDLE_MS) continue
    lastUsed.delete(user)
    await annex.pause(users[user]).catch((err) => console.error(`pausing ${user}: ${err.message}`))
    console.log(`${user}: paused after ${IDLE_MS / 60000} quiet minutes`)
  }
}, 30_000)

createServer(async (req, res) => {
  const user = /(?:^|; )user=([a-z0-9-]{1,32})/.exec(req.headers.cookie || '')?.[1]
  const json = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  if (req.method === 'GET' && req.url === '/') {
    return res.writeHead(200, { 'Content-Type': 'text/html' }).end(readFileSync(new URL('./index.html', import.meta.url)))
  }
  if (req.method === 'POST' && req.url === '/run') {
    if (!user) return json(401, { output: 'Pick a name first.' })
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const id = await sandboxFor(user)
      lastUsed.set(user, Date.now())
      const r = await annex.run(id, JSON.parse(body).command, { timeout: 120 })
      return json(200, { sandbox: id, output: r.output || '', exit: r.exit_code })
    } catch (err) {
      return json(500, { output: `Something went wrong: ${err.message}` })
    }
  }
  res.writeHead(404).end()
}).listen(3000, '127.0.0.1', () => console.log('http://localhost:3000'))
