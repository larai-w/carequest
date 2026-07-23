<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Private material — strategy, business, growth

- Business, growth, roadmap, pricing, revenue, sales/pilot, and market-analysis planning — plus
  internal worklogs and handovers — must **never** be committed to this public repo. They live in
  the private **`larai-w/veai-private`** repo (per-product folders; synced and backed up).
- Machine-local scratch may go in `docs-private/` (gitignored — local only, not synced).
- A pre-commit guard (`scripts/check_public_repo.py` via `.githooks/`) blocks this content and
  secrets from being committed here; never bypass it with `--no-verify`. A fresh clone runs
  `npm install` to set it up (or once: `git config core.hooksPath .githooks`).
