# Evals side by side

Run the same tasks past several models and see who passes what. Each model gets a clean machine of its own, set up identically, and the tests run there: nothing a model writes ever runs on your computer.

```sh
export ANTHROPIC_API_KEY=…
annex template apply
node evals.mjs                                      # three models
node evals.mjs claude-opus-5-5 claude-haiku-5-5     # or name them
```

You get one row a model and one column a task, with a score at the end.

## How it works

- `tasks.json` holds five small tasks: a sentence asking for a Python function, and the tests it must pass.
- For each model, `evals.mjs` starts a sandbox from the `evals` template, asks the model for each solution, uploads it beside its tests and runs them. Exit code 0 is a pass.
- The models are judged in parallel, one sandbox each.

## Make it yours

- Add tasks to `tasks.json`. Five tasks show the shape; they aren't enough to compare models, and one run of anything isn't either.
- What your tests need (a compiler, a package) goes in `annex.yml`'s `setup`, so every machine has exactly the same.
