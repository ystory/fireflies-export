# fireflies-export

CLI tool to incrementally export meeting transcripts from [Fireflies.ai](https://fireflies.ai) via its GraphQL API.

Designed for Fireflies API plans with daily request ceilings — keeps a local usage estimate, honors the API's explicit rate-limit response, and picks up where it left off on each run.

## Features

- **Incremental sync** — only fetches new meetings and uncollected transcripts
- **Crash recovery** — saves progress after each transcript; safely resume anytime
- **Rate limit aware** — tracks a local usage estimate and stops when Fireflies returns an explicit quota error
- **Raw data preservation** — stores original API responses as JSON files
- **Token-conscious archive** — downloads transcript JSON directly to disk so AI tools only need to read the specific local files or snippets they are asked to analyze

## Why local export if Fireflies MCP exists?

Fireflies [MCP tools](https://docs.fireflies.ai/mcp-tools/overview) and AI connectors are useful for interactive lookup: searching meetings, listing recent transcripts, fetching a single transcript, or asking for a summary when Fireflies has one. They are not a full replacement for a local archive.

MCP tools return meeting data back through the AI client. That is convenient for one-off questions, but long transcript bodies can consume model context tokens and may be limited by the client or model response path. `fireflies-export` fetches transcript data through the Fireflies GraphQL API and writes structured JSON directly to disk, so the collection step does not require streaming every transcript through the LLM context. You can later search or read only the local files needed for a specific task.

Use MCP for ad hoc discovery and analysis. Use `fireflies-export` when you need durable, account-scoped, resumable storage with a manifest, transcript files, raw sentence timing, and retry-after state.

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
2. Create a `.env` file in the directory where you'll run the tool.
   If you're working from a repository checkout, you can copy `.env.example`:

```bash
cp .env.example .env
```

   If you're using the published CLI outside this repository, create `.env` manually instead.

3. Fill in at least your API key:

```bash
FIREFLIES_API_KEY=your_api_key_here
```

4. Optional: add `FIREFLIES_DATA_ROOT` or `FIREFLIES_DATA_DIR` if you want custom local storage.

## Agent Skills

This repository also includes a public `fireflies-export` skill in the standard Agent Skills `SKILL.md` format.

Install it locally in any compatible agent environment:

```bash
npx skills add https://github.com/ystory/fireflies-export --skill fireflies-export -y
```

If the skill does not appear immediately, restart the agent session and reopen the same working directory.

The skill follows the same `.env` setup described above. If the current environment and local `.env` do not already provide a non-empty `FIREFLIES_API_KEY`, a compatible agent can ask for your Fireflies API key, create or update `.env` in the current working directory, and then run the export.
In most Agent Skills environments, users can ask naturally without naming the skill explicitly.

### Example prompts

- `Download my Fireflies transcripts in this folder.`
- `Set up Fireflies export here. If you need my API key, ask me for it.`
- `Run Fireflies export here and tell me if Fireflies wants us to wait before retrying.`

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
    └── <fireflies-user-id>/
        ├── .account.json      # Verified account metadata
        ├── manifest.json      # Meeting index with collection status
        ├── .request-counter.json
        └── transcripts/
            └── <meeting-id>.json
```

### Daily Workflow

Fireflies [documents](https://docs.fireflies.ai/fundamentals/limits) Free and Pro API plans at 50 requests per day, while Business and Enterprise plans use a higher per-minute limit. The CLI starts from a conservative local estimate of 50 API calls per UTC day. The meeting-list step also uses part of that budget, so the actual number of transcripts per run varies and larger backfills often take several days on daily-limited plans. Just run the command once daily:

```bash
fireflies-export
```

It will automatically skip already-collected transcripts and stop when Fireflies asks the client to wait before retrying.

### Rate-limit behavior

- `.request-counter.json` is a **local estimate**, not the server's source of truth
- The CLI stops immediately when Fireflies returns `too_many_requests`
- If Fireflies includes `retryAfter`, the CLI stores that timestamp and refuses new runs until that time passes
- `pnpm run smoke:rate-limit` also syncs the observed `retryAfter` into `.request-counter.json` for an already-resolved account
- The local counter still resets on a new UTC day, but that reset is advisory only

### Account-scoped storage

- By default, the CLI stores data under `data/accounts/<fireflies-user-id>/...`
- This prevents different Fireflies accounts from sharing the same manifest, transcript cache, or retry-after block state
- If the current API key has never been seen before, the CLI must successfully resolve the current owner before any files are written
- If owner lookup fails for a brand-new key, the CLI stops without writing files to avoid cross-account contamination
- This version does not auto-migrate older experimental account-scoping layouts or legacy unscoped `data/` directories
- `FIREFLIES_DATA_DIR` is an advanced escape hatch for an explicit custom directory and bypasses automatic account scoping

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FIREFLIES_API_KEY` | ✅ | — | Your Fireflies API key |
| `FIREFLIES_DATA_ROOT` | | `./data` | Shared root for automatic account-scoped storage |
| `FIREFLIES_DATA_DIR` | | — | Explicit final data directory override; bypasses automatic account scoping |

## Plan-dependent fields not collected

The following transcript fields are plan-dependent or optional in the Fireflies API and are **not collected** by this CLI:

- `audio_url` (Pro+)
- `video_url` (Business+)
- `analytics` (Pro+)
- `summary` (AI-generated summary data)

The CLI focuses on transcript archival data: full conversation sentences, raw text, speaker attribution, timestamps, attendees, and meeting metadata.

## Development

This repository also includes the source for the public `fireflies-export` Agent Skills package under `skills/fireflies-export`.

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
Use `pnpm run smoke:rate-limit` only when the current key is already blocked and the account has already been resolved locally.

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
