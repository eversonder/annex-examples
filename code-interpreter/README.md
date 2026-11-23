# Code interpreter

A chat that can run code. Ask "plot sales by month" with a CSV attached: the model writes Python, it runs in a sandbox that belongs to that chat alone, and the chart comes back to the page.

```sh
export ANTHROPIC_API_KEY=…
annex template apply      # saves annex.yml: Python, pandas, matplotlib
node server.mjs           # then open http://localhost:3000
```

## How it works

- `server.mjs` gives the model one tool, `run_python`. When the model calls it, the script is uploaded to the chat's sandbox and run there; what it printed goes back to the model.
- Any PNG the script saves in `/tmp/work/out` is downloaded and shown under the answer.
- Each browser tab is one chat with one sandbox, started on the first message and stopped by Annex after 30 quiet minutes (`idle_minutes`), or when you stop the server.
- Nothing the model writes runs on your computer.

## Make it yours

- More tools for the model: add them to `annex.yml`'s `setup`.
- Keep a chat's sandbox between visits: pause it instead of stopping it, as [sandbox-per-user](../sandbox-per-user) does.
- This server has no sign-in and listens on your own machine only. Put your own sign-in in front before anyone else can reach it: every chat spends on your accounts.
