# fireflies-export

## 0.1.4

### Patch Changes

- 39fde9b: Fix symlinked CLI entrypoints such as `npx fireflies-export` so they run the export instead of silently exiting without work.

## 0.1.3

### Patch Changes

- 946d285: Scope local export data by verified Fireflies account and fail closed when owner lookup cannot be determined for a new API key.

## 0.1.2

### Patch Changes

- 93da935: Sync authoritative rate-limit blocks into the local request counter during blocked-key smoke checks and make the collector entrypoints load `.env` reliably.

## 0.1.1

### Patch Changes

- 9d2072c: Use Fireflies retryAfter as the authoritative rate-limit signal instead of stopping on the local request counter.
