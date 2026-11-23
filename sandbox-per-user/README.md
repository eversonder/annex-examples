# A sandbox for every user

Every user of your product gets a computer of their own. It starts the first time they need it, pauses when they go quiet, and comes back with their files when they return.

```sh
node server.mjs           # then open http://localhost:3000
```

Pick a name, run `echo hello > note.txt`, wait five minutes, then run `cat note.txt`: the sandbox was paused in between and the file is still there. Open a second browser as another name and you are on a different machine.

## How it works

- `sandboxFor(user)` is the whole idea: look up the user's sandbox; resume it if it is paused; start one if they never had one.
- A timer pauses a sandbox after five minutes without a command. How much a paused sandbox costs depends on the provider: many release the machine and bill only its disk, some keep billing. The sandbox's `pause_billing_continues` says which.
- `users.json` maps a user to their sandbox. In a real product that is one column in your own records.

## Make it yours

- The "sign-in" here is a cookie with a name in it, so anyone can be anyone. Use your product's real sign-in.
- Give each user a ready environment: add `template: 'your-template'` to the start.
- Set limits on sandboxes at once and on monthly spend in the Annex dashboard, so a busy day can't surprise you.
