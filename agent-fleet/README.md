# A fleet for a big job

Split one job across many sandboxes. Each takes a piece from a shared queue, does it, writes its result to a shared store and takes the next, so a slow or lost sandbox costs one piece and not the run.

```sh
node fleet.mjs 5 urls.txt     # five sandboxes working through the list
```

The job here is small on purpose: fetch each page in `urls.txt` and count its words. You see a count tick up, then a table of every result and which sandbox did it.

## How it works

- The first sandbox makes a **task**; the others join it (`task: first.task`). Sandboxes of one task share queues and a key-value store, wherever each one runs.
- `fleet.mjs` pushes one message a job onto the queue `jobs`, then runs `worker.sh` in every sandbox.
- `worker.sh` is plain `curl`: claim a job, do it, write the result, say it's done. Annex puts the address and a token for the task in every sandbox's environment, and the token works for that task only.
- A claimed job that is never finished comes back for another sandbox after two minutes.

## Make it yours

- Replace `do_job` in `worker.sh` with your own work: one file of a migration, one shard of a test suite, one page to collect.
- A fleet may land on several providers at once. `route: 'cheapest'` fills the cheapest account first and moves on when it is full.
