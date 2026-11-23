// A chat that can run code. Claude writes Python, it runs in a sandbox that
// belongs to this chat alone, and the charts it draws come back to the page.
//
//   annex template apply && node server.mjs      then open http://localhost:3000
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { annex } from '../lib/annex.mjs'

const claude = new Anthropic() // ANTHROPIC_API_KEY
const WORK = '/tmp/work'
const SYSTEM = `You are a data analyst with a Python sandbox. Use run_python whenever a question needs
computing, a file read or a chart: pandas and matplotlib are installed. Files the person uploads are in
${WORK}. Save every chart as a PNG in ${WORK}/out (it is shown to the person automatically; don't mention
the path). State is not kept between runs, so each script loads what it needs. Answer plainly, numbers first.`

const chats = new Map() // chat id -> { sandbox, history }

async function chat(id, text, file) {
  let c = chats.get(id)
  if (!c) {
    const sb = await annex.start({ template: 'code-interpreter', idle_minutes: 30 })
    await annex.ready(sb.id)
    await annex.run(sb.id, `mkdir -p ${WORK}/out`)
    chats.set(id, (c = { sandbox: sb.id, history: [] }))
  }
  if (file) {
    const name = file.name.replace(/[^\w.-]/g, '_')
    await annex.upload(c.sandbox, `${WORK}/${name}`, Buffer.from(file.data, 'base64'))
    text += `\n\n(Uploaded: ${WORK}/${name})`
  }

  const images = []
  const runPython = betaTool({
    name: 'run_python',
    description: `Run a Python script in the sandbox and get what it printed. Working directory: ${WORK}.`,
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The whole script' } }, required: ['code'], additionalProperties: false },
    run: async ({ code }) => {
      await annex.upload(c.sandbox, `${WORK}/run.py`, code)
      const r = await annex.run(c.sandbox, `rm -f out/*; MPLBACKEND=Agg python3 run.py 2>&1`, { cwd: WORK, timeout: 300 })
      for (const f of await annex.files(c.sandbox, `${WORK}/out`).catch(() => [])) {
        if (f.name.endsWith('.png')) images.push(`data:image/png;base64,${(await annex.download(c.sandbox, f.path)).toString('base64')}`)
      }
      return `exit code ${r.exit_code}\n${(r.output || '').slice(-20_000)}`
    },
  })

  c.history.push({ role: 'user', content: text })
  const final = await claude.beta.messages.toolRunner({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    tools: [runPython],
    messages: c.history,
    // If the model declines a request, Anthropic serves it from a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  const answer = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  c.history.push({ role: 'assistant', content: answer || '(no answer)' }) // the words only: scripts are re-written as needed
  return { text: answer, images }
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return res.writeHead(200, { 'Content-Type': 'text/html' }).end(readFileSync(new URL('./index.html', import.meta.url)))
  }
  if (req.method === 'POST' && req.url === '/chat') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { id, text, file } = JSON.parse(body)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await chat(id, text, file)))
    } catch (err) {
      console.error(err)
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ text: `Something went wrong: ${err.message}`, images: [] }))
    }
    return
  }
  res.writeHead(404).end()
}).listen(3000, '127.0.0.1', () => console.log('http://localhost:3000'))

// Stop every sandbox when the server stops, so nothing is left running on your account.
process.on('SIGINT', async () => {
  await Promise.allSettled([...chats.values()].map((c) => annex.stop(c.sandbox)))
  process.exit(0)
})
