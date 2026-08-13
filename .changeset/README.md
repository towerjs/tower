# Changesets

This directory contains changeset files that describe version bumps for Tower packages.

All `@towerjs/*`, `towerjs`, and `create-tower` packages share a fixed version — they always move together.

See [Changesets documentation](https://github.com/changesets/changesets) for more information.

For the first public release, `first-public-release.md` is an empty release marker. It produces no version bump because all publishable packages are already set to `0.1.0`; it exists to drive the initial Changesets workflow. Do not replace it with a patch changeset, or the first release will become `0.1.1`.
