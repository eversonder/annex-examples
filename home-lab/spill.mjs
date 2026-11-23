// Start more sandboxes than your own machine has room for and see where each
// one lands: yours first, at $0 an hour, then your other accounts.
//
//   node spill.mjs 6
import { annex } from '../lib/annex.mjs'

const count = Number(process.argv[2] || 4)
const started = []
try {
  for (let i = 1; i <= count; i++) { // one at a time, so each sees the ones before it
    const sb = await annex.start({ route: 'cheapest', vcpu: 1, memory_gib: 1 })
    started.push(sb)
    const host = (await annex.run(sb.id, 'uname -nm')).output?.trim()
    console.log(`${i}. ${sb.provider.padEnd(12)} $${(sb.rate_per_hour_micros / 1e6).toFixed(4)}/h  ${host}`)
  }
} finally {
  await Promise.allSettled(started.map((sb) => annex.stop(sb.id)))
  console.log(`stopped all ${started.length}`)
}
