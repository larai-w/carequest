# Contributing to Care Quest

Thank you for contributing. Before opening anything, please read this repository's guidance in `README.md`, `AGENTS.md`, and `CLAUDE.md`.

## Public-repo boundary (required)

- Do not commit private strategy, business plans, pilot data, pricing/sales notes, credentials, personal data, or facility-identifying information.
- Keep only reviewable, public-safe evidence and code.
- Never add personal security-critical information or internal handover notes.

## Getting started

- Start from a small issue: define the expected behavior and one acceptance check.
- Fork or create a focused branch from the base branch.
- Keep changes narrow and reproducible.

## Open an issue

- Use Issues for bugs, reproducibility, and behavior questions.
- For user-facing UX/logic feedback, include steps to reproduce and expected vs actual behavior.
- For security findings, follow repository security instructions rather than public issue details.

## Make a PR

1. Reference the relevant issue in the PR title/body.
2. Keep commits focused and scoped.
3. Update docs if user-visible behavior changes.
4. Run the repository checks below before opening PR.

## Required checks

Before commit:

```bash
python3 scripts/check_public_repo.py --staged
```

For code changes, run the most relevant test/build steps from `README.md` or local project scripts.

## PR expectations

- Add tests when behavior changes.
- Keep configuration and secrets out of code.
- Describe risk and rollback plan for non-trivial changes in the PR body.

## License

By contributing, you agree your contribution is licensed under this repository's existing license.
