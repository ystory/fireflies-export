# Git and PR Guidance

Read this file when preparing a commit, opening or updating a pull request, deciding how to merge a pull request, or reviewing repository history conventions.

## Commit Rules

- Use Conventional Commits.
- Format: `<type>[optional scope]: <emoji> <subject>`
- Use exactly one Unicode gitmoji.
- Write commit messages in English and imperative mood.
- Keep the subject concise and specific.
- Prefer no scope over a weak or guessed scope.
- Use a scope only when it points to a real current area such as `cli`, `release`, `docs`, `tests`, `actions`, or `schemas`.
- Add a body only when the change includes multiple meaningful moves or the why would otherwise be unclear.
- Split unrelated changes into separate commits instead of one vague multi-purpose commit.

### Default Type to Gitmoji Mapping

- `feat`: ✨
- `fix`: 🐛
- `docs`: 📝
- `refactor`: ♻️
- `perf`: ⚡️
- `test`: ✅
- `style`: 🎨
- `build`: 📦
- `ci`: 👷
- `chore`: 🔧
- `revert`: ⏪️

### Examples

- `docs: 📝 add repo AGENTS guide`
- `fix(cli): 🐛 stop only on server-authoritative rate limits`
- `ci: 👷 skip changeset check for release PRs`

## Pull Request Rules

- Use English for PR titles and descriptions.
- Use a Conventional Commit style prefix in the PR title without a gitmoji.
- Keep each PR focused on one durable, reviewable outcome.
- Record the validation you ran, or explicitly say that no validation was needed.
- Call out release impact when the change affects Changesets, workflows, or npm publish behavior.
- Open a draft PR first when repository conventions, naming, or workflow shape are still being explored.

## Merge Rules

- Default to linear history.
- Prefer squash merge for normal pull requests unless the user explicitly asks for a different merge method.
- Delete the remote branch after merge when it is safe to do so.
- After assistant-driven merges, sync local `main` with `origin/main` and clean up temporary local branches or refs when safe.
