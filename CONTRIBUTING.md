# Contributing

Thanks for considering a contribution to `fireflies-export`.

## Before opening a pull request

1. Open an issue first for large changes, API shape changes, or behavior changes.
2. Keep each pull request focused on one verifiable outcome.
3. Prefer small follow-up pull requests over one large refactor.

## Local setup

```bash
pnpm install
pnpm run check
pnpm run check:package
```

Node.js `24.14.1` is the recommended local version. Node.js `22.14.0+` is the minimum supported runtime.

## Development guidelines

- Keep the CLI network-free in default tests.
- Treat Fireflies live API calls as opt-in smoke checks, not default CI.
- Preserve incremental sync behavior and quota accounting semantics.
- Add or update tests whenever behavior changes.
- Add a changeset for user-visible changes with `pnpm run changeset`.
- If a pull request should not trigger a package release, add an empty changeset with `pnpm run changeset:empty`.
- Run `pnpm run release:verify` before cutting a release.

## Release workflow

1. Add a changeset in the pull request that should affect the next release.
2. Merge changes into `main`.
3. The `Publish` workflow opens or updates a release pull request with version and changelog changes.
4. Merge that release pull request to publish to npm and create a GitHub Release.

## Pull request checklist

- Describe the user-visible change and why it is needed.
- Call out tradeoffs, migrations, or follow-up work.
- Include tests or explain why tests are not practical.
- Update documentation when commands, setup, or behavior changes.

## Questions and support

For general questions, use GitHub Issues or contact [oss@ystory.kr](mailto:oss@ystory.kr).
