# Contributing to Tower

## Requirements

Tower development requires:

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 11+

## Getting started

Clone the repository and install its dependencies:

```sh
pnpm install
```

Build all packages:

```sh
pnpm build
```

Before making changes, read [AGENTS.md](https://github.com/towerjs/tower/blob/main/AGENTS.md) for the repository's architecture, package boundaries, dependency rules, and development conventions.

## Development

Tower is a monorepo. Most work happens in `packages/`, with applications in `examples/` used to exercise Tower as a real application.

Run the test suite in watch mode while developing:

```sh
pnpm test:watch
```

The `examples/with-nextjs` application is the primary integration example. Start it with:

```sh
cd examples/with-nextjs
pnpm dev
```

When changing a package that affects application behavior, use the example application to verify the change in a real Tower application rather than relying only on isolated package tests.

## Making changes

### Bug fixes

Bug fixes are welcome. Open a pull request with:

- a clear description of the problem;
- the change that fixes it;
- a regression test when practical;
- any relevant documentation updates.

For larger or architectural changes, open an issue or discussion first so the approach can be reviewed before implementation.

### New features

Please discuss substantial new features before opening a pull request.

Tower is an opinionated framework, so a feature is not evaluated only on whether it can be implemented. We also need to consider whether it belongs in Tower, how it fits the existing application model, and what API it should establish for future applications.

A pull request may therefore be closed even when the implementation itself is good if the feature is not currently planned or the API needs further design.

## Code quality

Run the project's checks before submitting a pull request:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

To format the repository:

```sh
pnpm format
```

Formatting rules are defined by the repository's Prettier configuration.

For end-to-end tests, Docker with PostgreSQL is required:

```sh
pnpm test:e2e
```

When a build succeeds, the package tarballs in the `dist/` directories can also be used to test local package installations.

## Architecture

Tower is designed as a cohesive application framework with modular, replaceable foundations. Packages should have clear responsibilities and communicate through deliberate public interfaces.

Before changing an existing module or adding a new one, understand where the behavior belongs. In particular:

- **Foundation** provides application composition, configuration, dependency injection, and initialization.
- **Blueprint** defines the structure and configuration of a Tower application.
- **Atlas** provides application routing conventions where the underlying framework does not already provide them.
- **Vault** provides database access and infrastructure abstractions; application-owned data models remain under application control.
- **Tower modules** such as Gatehouse, Archive, Beacon, Crane, Messenger, Treasury, and Watchtower provide higher-level capabilities Tower owns.
- **Adapters and providers** keep infrastructure choices behind stable Tower APIs where appropriate.
- **Framework integrations** belong in their framework-specific boundaries rather than in core packages.

Tower is intended to work across modern execution environments, including serverless environments. Do not introduce assumptions that require a persistent application process unless the feature explicitly requires one.

When making architectural changes, preserve these principles:

- **Opinionated** — Tower should make useful application-level decisions rather than abstract every possible approach.
- **Composable** — Applications can use the Tower capabilities they need.
- **Portable** — Supported infrastructure implementations can change without forcing an application to change its overall architecture.
- **Framework-friendly** — Tower works with application frameworks rather than unnecessarily replacing them.
- **Serverless-compatible** — Core modules should not assume a long-running process.
- **Small, deliberate interfaces** — Public APIs should be designed for application developers, not merely expose underlying implementation details.

## Documentation

Documentation lives in `docs/`, package READMEs, and the repository `README.md`.

Update documentation in the same pull request whenever a change affects the developer-facing surface, including:

- public APIs;
- configuration;
- providers or adapters;
- CLI commands;
- generated project structure;
- module behavior;
- application conventions;
- new or changed features.

Changes to generated output must remain consistent with the documentation that describes it, including the Scribe and getting-started documentation.

Internal refactors, dependency updates, tests, and other changes that do not affect behavior generally do not require documentation updates.

## Pull requests

A good pull request should make it easy to understand **what changed, why it changed, and how it was verified**.

Include:

- a concise title and description;
- the motivation and relevant context;
- a test plan;
- documentation updates when needed.

Before opening the pull request, make sure the relevant checks pass:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Contributions that change behavior should include tests. New public APIs should also include appropriate type-level coverage.

Open pull requests through the repository's [pull request page](https://github.com/towerjs/tower/pulls).

## Commit messages

Use conventional commits with the affected package as the scope:

```text
feat(gatehouse): add passkey update action
fix(vault): handle pool close on shutdown
refactor(gatehouse): extract api builder
chore(deps): upgrade vitest
docs(vault): document kysely provider
```

Use the package directory name as the scope. Use `root` for repository-level changes such as CI, configuration, or the README, and `docs` with the owning package when appropriate.

Keep the subject:

- imperative;
- concise;
- on one line;
- without a trailing period.

Add a body only when the subject does not adequately explain the change, such as for a non-obvious fix, tradeoff, breaking change, or issue reference. Explain **why**, not what the diff already makes clear.

```text
fix(vault): close pool on shutdown

The pool held sockets open after SIGTERM, keeping the process alive.

Closes #123
```

Keep commit bodies wrapped at 72 characters.

## Communication

Use the appropriate GitHub channel:

- **Discussions** — feature ideas, architectural questions, and general questions
- **Issues** — confirmed bugs and actionable problems
- **Pull requests** — proposed code and documentation changes

For significant architectural work, start with a discussion before investing in a large implementation.
