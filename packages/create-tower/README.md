# `create-tower`

[![npm version](https://img.shields.io/npm/v/create-tower?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/create-tower)

Quick-start scaffolding for new Tower applications.

## Usage

```bash
pnpm create tower
```

Follow the interactive prompts to select your framework, modules, and deployment target. A new Tower project will be scaffolded in a directory named after your project.

## What you get

- A ready-to-run application with your chosen framework (Next.js)
- `tower.config.ts` with your module configuration
- `.env` and `.env.example` with environment variables for your selected modules
- Auth routes and middleware (if Gatehouse is selected)
- Database setup (if Vault is selected)
- All required dependencies installed

## Behind the scenes

`create-tower` is a thin wrapper around `@towerjs/scribe`'s `createCommand`. It delegates all prompts and generation to the Scribe package.
