// Run the same tasks past several models, each on its own clean machine, and
// print who passed what. The model writes the code; the sandbox runs the
// tests, so nothing a model writes ever runs on your computer.
//
//   annex template apply && node evals.mjs
//   node evals.mjs claude-opus-5-5 claude-haiku-5-5      to choose the models
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { annex } from '../lib/annex.mjs'

const claude = new Anthropic() // ANTHROPIC_API_KEY
const models = process.argv.length > 2 ? process.argv.slice(2) : ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const tasks = JSON.parse(readFileSync(new URL('./tasks.json', import.meta.url), 'utf8'))

async function solve(model, task) {
  // No fallback model here on purpose: an eval should score the model it names.
  const res = await claude.messages.create({
    model,
    max_tokens: 16000,
    system: 'Reply with one Python module and nothing else: no explanation, no code fences.',
    messages: [{ role: 'user', content: task.prompt }],
  })
  if (res.stop_reason === 'refusal') return ''
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  return text.replace(/^```\w*\n|\n```\s*$/g, '')
}

async function judge(model) {
  const sb = await annex.start({ template: 'evals' })
  try {
    await annex.ready(sb.id)
    const row = { model }
    for (const task of tasks) { // one at a time: each gets the machine to itself
      const dir = `/tmp/${task.name}`
      await annex.run(sb.id, `mkdir -p ${dir}`)
      await annex.upload(sb.id, `${dir}/solution.py`, (await solve(model, task)) || 'raise SystemExit("no answer")')
      await annex.upload(sb.id, `${dir}/test.py`, task.test)
      const r = await annex.run(sb.id, 'python3 test.py', { cwd: dir, timeout: 60 })
      row[task.name] = r.exit_code === 0 ? 'pass' : 'FAIL'
    }
    row.score = `${tasks.filter((t) => row[t.name] === 'pass').length}/${tasks.length}`
    return row
  } finally {
    await annex.stop(sb.id)
  }
}

console.log(`${tasks.length} tasks, ${models.length} models, one sandbox each…`)
const rows = await Promise.allSettled(models.map(judge))
console.table(rows.map((r, i) => (r.status === 'fulfilled' ? r.value : { model: models[i], score: `error: ${r.reason.message}` })))
