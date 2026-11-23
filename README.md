# Annex examples

Six small things to build with [Annex](https://annex.eversonder.com): one API that gets an agent a computer from any sandbox provider you have connected, or from a machine of your own. Each folder is a whole project in under 300 lines that you can read in one sitting and run in a few minutes.

| Example | What you get |
|---|---|
| [code-interpreter](code-interpreter) | A chat that writes Python, runs it and shows the chart |
| [sandbox-per-user](sandbox-per-user) | A computer for every user of your product, paused when they leave |
| [issue-to-pr](issue-to-pr) | Label a GitHub issue, get a pull request |
| [agent-fleet](agent-fleet) | One big job split across many sandboxes |
| [evals-side-by-side](evals-side-by-side) | The same tasks past several models, each on a clean machine |
| [home-lab](home-lab) | Your agents on a Mac mini or a Raspberry Pi, with the cloud as overflow |

## Before any of them

1. Make an Annex account and connect at least one provider (or [one of your own machines](https://annex.eversonder.com/providers/your-own-servers)).
2. Install the `annex` command and sign in:
   ```sh
   curl -fsSL https://annex.eversonder.com/cli/install.sh | sh
   annex login
   ```
3. Get this repository and its one dependency (Node 20 or later):
   ```sh
   git clone https://github.com/eversonder/annex-examples && cd annex-examples && npm install
   ```

The examples read the key `annex login` saved. To use another, set `ANNEX_API_KEY`. The two that call a model (`code-interpreter` and `evals-side-by-side`) also need `ANTHROPIC_API_KEY`.

## What they share

- [`lib/annex.mjs`](lib/annex.mjs): a client for Annex's API in about a hundred lines, with no dependencies. Copy it into your own project.
- An `annex.yml` where the example needs tools installed. `annex template apply` saves it as a template; the set-up runs in the first sandbox and its result is reused in the ones after.
- Every example stops the sandboxes it started, so nothing is left running on your account. Sandboxes run on your own provider accounts and your provider bills you for them.

## Licence

MIT. See [LICENSE](LICENSE).
