# Changesets

This directory contains changeset files that describe version bumps for Tower packages.

All `@towerjs/*`, `towerjs`, and `create-tower` packages share a fixed version — they always move together.

See [Changesets documentation](https://github.com/changesets/changesets) for more information.

For the first public release, all publishable packages are already set to `0.1.0`. Keep the Changesets directory empty until the initial packages are published; an empty Changeset file makes `changesets/action` stop without publishing. Future Changesets should describe normal version bumps.
