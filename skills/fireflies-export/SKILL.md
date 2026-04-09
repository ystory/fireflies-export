---
name: fireflies-export
description: Use this skill when a user wants to export Fireflies.ai meeting transcripts, set up or repair a local fireflies-export run, create a missing .env from their Fireflies API key, explain account-scoped local storage, or troubleshoot public CLI failures such as too_many_requests, auth_failed, or owner lookup failures.
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

Before asking the user for anything, confirm whether a non-empty `FIREFLIES_API_KEY` is already available from either of these sources:

- An existing `FIREFLIES_API_KEY` in the environment
- A local `.env` file in the current working directory that sets `FIREFLIES_API_KEY` to a non-empty value

If neither source provides a non-empty key, ask the user for their Fireflies API key and create or update a local `.env` file in the current working directory before running the export.

If `.env.example` exists in that directory, prefer copying it to `.env` and filling in the key. Otherwise, create `.env` manually with at least:

```bash
FIREFLIES_API_KEY=your_api_key_here
```

Keep the generated `.env` local to the working directory. Do not stage or commit it.

Support these optional environment variables only when the user needs custom local storage:

- `FIREFLIES_DATA_ROOT` to change the shared root for automatic account-scoped storage
- `FIREFLIES_DATA_DIR` to force one explicit final data directory and bypass automatic account scoping

Use `.env` for normal usage. Mention shell exports only when the user is already working directly in the shell.

## Expected Behavior

Explain the public CLI in these terms:

- Resolve the current Fireflies account before writing files
- Store data under `data/accounts/<fireflies-user-id>/...` by default
- Reuse existing manifest and transcript files for incremental sync
- Show a local API usage estimate with a default ceiling of 50 API calls per UTC day
- Stop when Fireflies returns `too_many_requests`
- Persist `retryAfter` when Fireflies provides it and refuse new runs until that time passes

If the current API key owner cannot be determined, explain that the CLI stops without writing files to avoid mixing data across accounts.

## Quota Awareness

Guide users with these assumptions:

- The local estimate starts at 50 API calls per UTC day, not 50 transcript downloads
- Collecting the meeting list also uses part of that budget, so transcripts-per-run varies
- Larger backfills on the Free plan often take multiple daily runs
- Fireflies `too_many_requests` and `retryAfter` are the authoritative stop signals; the local counter is advisory only

## Safe Operating Rules

Follow these safety rules when guiding a user:

- Do not suggest fallback behavior that mixes multiple Fireflies accounts into the same local directory
- Do not treat the local request counter as the server's source of truth
- Do not treat the mere presence of `.env` as proof that setup is complete
- Do not ask for the API key again if the current environment or local `.env` already provides a non-empty `FIREFLIES_API_KEY`
- Do not echo the user's API key back in logs or explanations unless they explicitly ask to inspect it
- Do not describe repository-only commands, test commands, or development scripts as part of the public interface
- Do not promise writes for a blocked or unverified key when owner resolution fails
- Do not describe the 50/day local estimate as a guaranteed transcript count
- Do not treat exit code `0` alone as proof that an export ran; confirm the CLI banner, collection logs, or `data/accounts/*` output before calling it successful
- If `npx fireflies-export` exits without logs or account-scoped output, treat it as a suspected no-op and re-check the resolved entrypoint before declaring success

When a user needs a custom path, prefer `FIREFLIES_DATA_DIR=/path ...` over ad hoc file moves.

## Troubleshooting

Interpret these failures in the public CLI context:

- `FIREFLIES_API_KEY is not set`: ask for the Fireflies API key, create or update `.env` in the working directory, then rerun from that same directory
- `too_many_requests`: Fireflies is asking the client to wait; tell the user to retry after the reported time
- `auth_failed`: the API key is invalid or no longer usable; tell the user to replace the key
- `Could not determine the Fireflies account... no files were written`: owner lookup failed, so the CLI refused to start to protect local data boundaries

When explaining a failure, separate the meaning of the error from the next action. Keep the next action short and concrete.

Keep `node .../dist/cli.js` as an internal diagnostic fallback only. Do not present it as the normal public CLI usage unless the user is explicitly debugging entrypoint behavior.

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
