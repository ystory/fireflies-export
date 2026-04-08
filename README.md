# fireflies-export

CLI tool to incrementally export meeting transcripts from [Fireflies.ai](https://fireflies.ai) via its GraphQL API.

Designed for the **Free plan** — keeps a local usage estimate, honors the API's explicit rate-limit response, and picks up where it left off on each run.

## Features

- **Incremental sync** — only fetches new meetings and uncollected transcripts
- **Crash recovery** — saves progress after each transcript; safely resume anytime
- **Rate limit aware** — tracks a local usage estimate and stops when Fireflies returns an explicit quota error
- **Raw data preservation** — stores original API responses as JSON files

## Prerequisites

- Node.js 24.14.1 LTS recommended (`.node-version`)
- Node.js 22 LTS is also checked in CI for compatibility
- A [Fireflies.ai](https://fireflies.ai) account with an API key

## Installation

```bash
npm install -g fireflies-export
```

Or use directly with npx:

```bash
npx fireflies-export
```

## Setup

1. Get your API key from [Fireflies Integrations → Fireflies API](https://app.fireflies.ai/integrations/custom/fireflies)
2. Copy `.env.example` to `.env` in the directory where you'll run the tool:

```bash
cp .env.example .env
```

3. Fill in your API key:

```bash
FIREFLIES_API_KEY=your_api_key_here
```

## Usage

Run from the directory containing your `.env` file:

```bash
fireflies-export
```

This will:
1. **Resolve the current Fireflies account** — determines the current API key owner before any files are written
2. **Collect meeting list** — fetches meeting metadata into the account-scoped manifest
3. **Download transcripts** — saves each meeting's full transcript into the same account-scoped directory

### Output Structure

```
data/
├── .account-index.json        # Local token-to-account mapping cache
└── accounts/
    ├── <fireflies-user-id>/
    │   ├── .account.json      # Verified account metadata
    │   ├── manifest.json      # Meeting index with collection status
    │   ├── .request-counter.json
    │   └── transcripts/
    │       └── <meeting-id>.json
    └── provisional-<token-fingerprint>/
        └── ...                # Optional provisional legacy migration target
```

### Daily Workflow

With 200+ meetings, the initial export takes several days on the Free plan (~36 transcripts/day after list collection). Just run the command once daily:

```bash
fireflies-export
```

It will automatically skip already-collected transcripts and stop when Fireflies asks the client to wait before retrying.

### Rate-limit behavior

- `.request-counter.json` is a **local estimate**, not the server's source of truth
- The CLI stops immediately when Fireflies returns `too_many_requests`
- If Fireflies includes `retryAfter`, the CLI stores that timestamp and refuses new runs until that time passes
- `pnpm run smoke:rate-limit` also syncs the observed `retryAfter` into `.request-counter.json`
- The local counter still resets on a new UTC day, but that reset is advisory only

### Account-scoped storage

- By default, the CLI stores data under `data/accounts/<fireflies-user-id>/...`
- This prevents different Fireflies accounts from sharing the same manifest, transcript cache, or retry-after block state
- If the current API key has never been seen before, the CLI must successfully resolve the current owner before any files are written
- If owner lookup fails for a brand-new key, the CLI stops without writing files to avoid cross-account contamination
- If a known key was manually migrated into a provisional directory, the CLI can keep using that token-specific provisional directory until owner lookup succeeds and promotes it to the real `user_id`
- `FIREFLIES_DATA_DIR` is an advanced escape hatch for an explicit custom directory and bypasses automatic account scoping

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FIREFLIES_API_KEY` | ✅ | — | Your Fireflies API key |
| `FIREFLIES_DATA_ROOT` | | `./data` | Shared root for automatic account-scoped storage |
| `FIREFLIES_DATA_DIR` | | — | Explicit final data directory override; bypasses automatic account scoping |

## Free Plan Limitations

The following transcript fields are only available on paid plans and are **not collected**:

- `audio_url` (Pro+)
- `video_url` (Business+)
- `summary` (paid plans)

All other data — including full conversation sentences, speakers, attendees, and meeting metadata — is collected on the Free plan.

## Development

```bash
# Clone and install
git clone https://github.com/ystory/fireflies-export.git
cd fireflies-export
pnpm install

# Run in development mode
pnpm run collect

# Lint and static checks
pnpm run lint
pnpm run lint:fix
pnpm run typecheck

# Tests
pnpm run test
pnpm run test:watch
pnpm run test:coverage

# Optional live smoke (requires FIREFLIES_API_KEY)
pnpm run smoke:live

# Optional rate-limit smoke (expects the current key to already be rate-limited)
pnpm run smoke:rate-limit

# One-time migration for legacy unscoped ./data into a provisional account dir
pnpm run migrate:legacy-account

# Full local quality gate
pnpm run check

# Package contract checks
pnpm run check:package

# Release verification gate
pnpm run release:verify

# Add a release note entry for user-visible changes
pnpm run changeset

# Mark a PR as no-release while still satisfying release intent checks
pnpm run changeset:empty

# Inspect the pending release plan
pnpm run release:status

# Build
pnpm run build
```

CI runs `pnpm run check:ci` on pushes and pull requests.
The default test suite is network-free; keep Fireflies API smoke checks as manual or opt-in runs.
Use `pnpm run smoke:rate-limit` only when the current key is already blocked and you want to verify the live 429 contract.
Use `pnpm run migrate:legacy-account` once before switching from the old unscoped `data/` layout to account-scoped storage.

## Release workflow

1. Add a changeset for user-visible changes with `pnpm run changeset`.
   If the pull request should not release the package, use `pnpm run changeset:empty` instead.
2. Merge approved work into `main`.
3. The `Publish` workflow opens or updates a release pull request with version and changelog changes.
   This repository expects a `RELEASE_PR_TOKEN` Actions secret so the release PR can trigger the normal pull-request checks.
   The release pull request itself skips the changeset-presence check because it is the step that consumes those changesets.
4. Merge the release pull request to publish to npm and create a GitHub Release.

## Contributing and support

- Contribution guide: [CONTRIBUTING.md](https://github.com/ystory/fireflies-export/blob/main/CONTRIBUTING.md)
- Support policy: [SUPPORT.md](https://github.com/ystory/fireflies-export/blob/main/SUPPORT.md)
- Security policy: [SECURITY.md](https://github.com/ystory/fireflies-export/blob/main/SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](https://github.com/ystory/fireflies-export/blob/main/CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
