---
name: fireflies-export
description: Export Fireflies.ai meeting transcripts with the public fireflies-export CLI. Use when an agent needs to set up or run incremental transcript export from a local .env file, explain account-scoped local storage, or troubleshoot public CLI failures such as too_many_requests, auth_failed, or owner lookup failures.
---

# Fireflies Export

## Quick Start

Use `npx fireflies-export` as the default entrypoint for normal CLI usage from a directory that is not the `fireflies-export` source repository.

If the current working directory is the `fireflies-export` source repository, do not assume bare `npx fireflies-export` will run the published package. Prefer running the CLI from a different working directory, or install it globally for repeated local use.

Recommend:

```bash
npx fireflies-export
```

Offer global installation only when the user expects repeated local use:

```bash
npm install -g fireflies-export
fireflies-export
```

Assume the command runs from the directory that contains the user's `.env` file unless they explicitly say otherwise.

## Required Setup

Require:

```bash
FIREFLIES_API_KEY=your_api_key_here
```

Support these optional environment variables only when the user needs custom local storage:

- `FIREFLIES_DATA_ROOT` to change the shared root for automatic account-scoped storage
- `FIREFLIES_DATA_DIR` to force one explicit final data directory and bypass automatic account scoping

Use `.env` for normal usage. Mention shell exports only when the user is already working directly in the shell.

## Expected Behavior

Explain the public CLI in these terms:

- Resolve the current Fireflies account before writing files
- Store data under `data/accounts/<fireflies-user-id>/...` by default
- Reuse existing manifest and transcript files for incremental sync
- Stop when Fireflies returns `too_many_requests`
- Persist `retryAfter` when Fireflies provides it and refuse new runs until that time passes

If the current API key owner cannot be determined, explain that the CLI stops without writing files to avoid mixing data across accounts.

## Safe Operating Rules

Follow these safety rules when guiding a user:

- Do not suggest fallback behavior that mixes multiple Fireflies accounts into the same local directory
- Do not treat the local request counter as the server's source of truth
- Do not describe repository-only commands, test commands, or development scripts as part of the public interface
- Do not promise writes for a blocked or unverified key when owner resolution fails

When a user needs a custom path, prefer `FIREFLIES_DATA_DIR=/path ...` over ad hoc file moves.

## Troubleshooting

Interpret these failures in the public CLI context:

- `too_many_requests`: Fireflies is asking the client to wait; tell the user to retry after the reported time
- `auth_failed`: the API key is invalid or no longer usable; tell the user to replace the key
- `Could not determine the Fireflies account... no files were written`: owner lookup failed, so the CLI refused to start to protect local data boundaries

When explaining a failure, separate the meaning of the error from the next action. Keep the next action short and concrete.

## Command Examples

Default run from a non-source working directory:

```bash
npx fireflies-export
```

Repeated local use, including source-repository environments:

```bash
npm install -g fireflies-export
fireflies-export
```

Custom shared data root:

```bash
FIREFLIES_DATA_ROOT=./fireflies-data npx fireflies-export
```

Explicit final data directory override:

```bash
FIREFLIES_DATA_DIR=/absolute/path/to/export npx fireflies-export
```
