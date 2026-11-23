# Issue to pull request

Label a GitHub issue `agent`. A sandbox starts, Claude Code clones the repository there, fixes the issue, runs the tests, and opens a pull request for you to review.

## Set up

1. **A token for the repository.** Make a fine-grained GitHub token limited to the one repository, with read and write on Contents and Pull requests.
2. **A secret group.** In the Annex dashboard, under Secrets, make a group named `issue-to-pr` holding `GH_TOKEN` (that token) and `ANTHROPIC_API_KEY`. They are put in the sandbox's environment and nowhere else: this server never sees them.
3. **The template and the listener:**
   ```sh
   annex template apply
   GITHUB_WEBHOOK_SECRET=choose-a-long-random-string node server.mjs
   ```
4. **Tell GitHub.** In the repository's settings, add a webhook to `https://<where this runs>/webhook`, content type `application/json`, the same secret, and only the **Issues** event. On your own computer, a tunnel such as `cloudflared tunnel --url http://localhost:3000` gives it an address.

## How it works

- `server.mjs` checks GitHub's signature on every notification and ignores everything but the `agent` label being added.
- The work is a short shell script run in the sandbox: clone, branch, `claude -p`, commit, push, `gh pr create`. The sandbox is stopped afterwards whatever happened.
- The issue's text reaches the sandbox as a file and its title as an environment variable, never as part of a command.

## Before you rely on it

- **An issue is text a stranger can write, and the agent reads it.** The sandbox keeps a misled agent away from your computer, but it holds the token: keep that token to one repository, and only label issues you have read.
- Review every pull request. The agent can be wrong, and nothing here merges by itself.
- The Claude Code flags in the script are the ones it documents for running without prompts in a sandbox; check its docs if they change.
