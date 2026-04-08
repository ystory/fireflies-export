# fireflies-export Agent Guide

## Scope

- This file defines repo-wide instructions for `fireflies-export`.
- Keep guidance here short and durable. Put user-specific working preferences in the global Codex layer, not in this repository file.

## Start Here

- Read [README.md](./README.md) first for product behavior, setup, development commands, and the release workflow.
- Use [package.json](./package.json) as the source of truth for supported scripts.

## Core Workflow

- `main` is protected. Make changes on a branch and use a pull request.
- Prefer focused, root-cause-complete changes over broad refactors.
- Update `README.md` and `CONTRIBUTING.md` when commands, release behavior, or operator-facing workflow changes.

## Validation

- Default verification for meaningful code changes: `pnpm run check:ci`
- For release-flow changes, also run: `pnpm run release:status`
- Do not claim a fix is complete until the validation matches the failure mechanism you changed.

## Fireflies API Boundaries

- Keep the default test suite network-free.
- Treat `pnpm run smoke:live` and `pnpm run smoke:rate-limit` as opt-in manual checks, not default CI steps.
- Preserve the current rate-limit contract:
  - `.request-counter.json` is only a local estimate
  - Fireflies `too_many_requests` and `retryAfter` are the authoritative stop signals

## Release Rules

- User-visible changes need a changeset: `pnpm run changeset`
- PRs that should not release still need an empty changeset: `pnpm run changeset:empty`
- Release PRs are managed by Changesets on `changeset-release/*`
- Release PRs intentionally skip the changeset-presence check because they consume existing changesets
- The release workflow expects the `RELEASE_PR_TOKEN` Actions secret so release PR checks trigger normally
