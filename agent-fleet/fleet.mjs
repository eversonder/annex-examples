// Split one big job across a fleet. Every sandbox joins one task, so they
// share a queue of jobs and a store for results; each takes a job, does it and
// takes the next, so a slow or lost sandbox costs one job, not the run.
//
//   node fleet.mjs 5 urls.txt        five sandboxes working through the list
import { readFileSync } from 'node:fs'
import { annex } from '../lib/annex.mjs'

const size = Number(process.argv[2] || 3)
const jobs = readFileSync(process.argv[3] || new URL('./urls.txt', import.meta.url), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
const worker = readFileSync(new URL('./worker.sh', import.meta.url))

// The first sandbox makes the task; the rest join it.
const first = await annex.start({ route: 'cheapest', vcpu: 1, memory_gib: 1 })
const rest = await Promise.all(Array.from({ length: size - 1 }, () => annex.start({ route: 'cheapest', vcpu: 1, memory_gib: 1, task: first.task })))
const fleet = [first, ...rest]
console.log(`${fleet.length} sandboxes on ${[...new Set(fleet.map((s) => s.provider))].join(', ')}; ${jobs.length} jobs`)

try {
  for (const url of jobs) await annex.push(first.task, 'jobs', { url })
  const working = fleet.map(async (sb) => {
    await annex.upload(sb.id, '/tmp/worker.sh', worker)
    return annex.run(sb.id, `ANNEX_SANDBOX_ID=${sb.id} sh /tmp/worker.sh`, { timeout: 3600 })
  })
  const progress = setInterval(async () => {
    process.stdout.write(`\r${(await annex.kv(first.task, 'results-')).length} of ${jobs.length} done`)
  }, 3000)
  await Promise.all(working)
  clearInterval(progress)

  const results = (await annex.kv(first.task, 'results-')).map((r) => r.value)
  console.log(`\r${results.length} of ${jobs.length} done\n`)
  console.table(results.map((r) => ({ url: r.url, words: r.words, sandbox: r.by })))
} finally {
  await Promise.allSettled(fleet.map((sb) => annex.stop(sb.id))) // nothing left running on your account
}
