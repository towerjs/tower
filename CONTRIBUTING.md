# Contributing to Tower

## Requirements

Before getting started, ensure your system has access to the following tools:

- [Node.js](https://nodejs.org/) (v22+)
- [pnpm](https://pnpm.io/) (v11+)

## Getting started

```sh
# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Development workflow

During development, you can run tests in watch mode:

```sh
pnpm test:watch
```

The `examples/with-nextjs` directory contains a reference Next.js application you can use to test your changes. To start it:

```sh
cd examples/with-nextjs
pnpm dev
```

## Bug fixes

If you've found a bug in Tower that you'd like to fix, [submit a pull request](https://github.com/hyphenzero/tower/pulls) with your changes. Include a helpful description of the problem and how your changes address it, and provide tests so we can verify the fix works as expected.

## New features

If there's a new feature you'd like to see added to Tower, [share your idea with us](https://github.com/hyphenzero/tower/discussions/new?category=ideas) in our discussion forum to get it on our radar as something to consider for a future release before starting work on it.

**Please note that we don't often accept pull requests for new features.** Adding a new feature to Tower requires us to think through the entire problem ourselves to make sure we agree with the proposed API, which means the feature needs to be high on our own priority list for us to be able to give it the attention it needs.

If you open a pull request for a new feature, we're likely to close it not because it's a bad idea, but because we aren't ready to prioritize the feature and don't want the PR to sit open for months or even years.

## Coding standards

Our code formatting rules are defined in the `"prettier"` section of [package.json](https://github.com/hyphenzero/tower/blob/main/package.json). You can check your code against these standards by running:

```sh
pnpm lint
```

To automatically fix any style violations in your code, you can run:

```sh
pnpm format
```

## Running tests

You can run the test suite using the following command:

```sh
pnpm test
```

To run the E2E tests (requires Docker for Postgres):

```sh
pnpm test:e2e
```

To run type checking:

```sh
pnpm typecheck
```

Please ensure that all tests are passing when submitting a pull request. If you're adding new features to Tower, always include tests.

After a successful build, you can also use the npm package tarballs created inside the `dist/` folders to install your build in other local projects.

## Pull request process

When submitting a pull request:

- Ensure the pull request title and description explain the changes you made and why you made them.
- Include a test plan section that outlines how you tested your contributions. We do not accept contributions without tests.
- Ensure all tests pass (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`).

When a pull request is created, Tower maintainers will be notified automatically.

## Communication

- **GitHub Discussions**: For feature ideas and general questions
- **GitHub Issues**: For bug reports
- **GitHub Pull Requests**: For code contributions

## Architecture guidelines

Tower follows a layered architecture where each module lives in its own package under `packages/` and communicates through well-defined interfaces. Please review [AGENTS.md](AGENTS.md) for architectural principles, dependency rules, and import conventions before making changes.

Key principles:

- **Provider-agnostic** — Modules abstract over specific providers behind a stable API
- **Framework-first** — Works alongside the user's framework rather than replacing it
- **Lazy initialization** — Tower apps initialize on first use, not at import time
- **Minimal API surface** — Modules export only what users need
- **No runtime dependencies on user-facing frameworks** — Framework adapters live in `packages/*/src/frameworks/`

## Commit style

Use conventional commits with the package name as scope:

```
feat(gatehouse): add passkey update action
fix(vault): handle pool close on shutdown
refactor(gatehouse): extract api builder
chore(deps): upgrade vitest
docs(vault): document kysely-neon provider
```

Scopes match package directory names: `foundation`, `blueprint`, `vault`, `gatehouse`, `courier`, `scribe`, `create-tower`, `towerjs`, `edge`. Use `root` for root-level changes (config, CI, README). Use `docs` with the owner package as scope for documentation.

**Commit message bodies** — The subject is the commit's identity: keep it to one line, imperative, no trailing period. Add a body only when the subject can't carry the _why_ — a non-obvious fix or tradeoff, a breaking change, an issue reference. Put it one blank line below the subject, wrap at 72 characters, and explain _why_, not _what_ (the diff shows what):

```
fix(vault): close pool on shutdown

The pool held sockets open after SIGTERM, keeping the process alive.

Closes #123
```

Skip the body when the change is self-explanatory (e.g. dependency bumps, pure formatting).
