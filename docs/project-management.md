# Care Quest project management

Last updated: 2026-07-06 JST

This document defines how to manage Care Quest with GitHub Issues and GitHub Projects.

## Current Recommendation

Use GitHub Issues as durable task records and GitHub Projects as the board/roadmap view.

Why:

- Issues work well with PRs, CI, labels, and release history.
- Projects can show the same issues by status, priority, area, and iteration.
- Codex/Claude Code can work from issue descriptions and update status in docs/PRs.

## Automation Reality

GitHub Projects can be automated through the GitHub GraphQL API and GitHub CLI. GitHub's docs state that Projects can be managed with GraphQL, and the `gh project` command supports project creation, fields, and items when authenticated with the `project` scope.

Current local limitation:

- `gh` is not installed in this environment.
- The connected GitHub app tools available here can inspect some Actions data, but they do not expose GitHub Project creation/editing or repository secret inspection.

Practical approach:

1. Create the GitHub Project manually once, or run the bootstrap commands from a machine with `gh`.
2. Use issues as project items.
3. Use labels and issue templates so work stays structured even before full automation.

## Suggested GitHub Project

Project name:

```text
Care Quest MVP
```

Recommended views:

- Board by `Status`
- Table by `Priority`
- Roadmap by `Target`
- Area view grouped by `Area`

Recommended fields:

| Field | Type | Values |
| --- | --- | --- |
| Status | single select | Backlog, Ready, In progress, Blocked, Review, Done |
| Priority | single select | P0, P1, P2, P3 |
| Area | single select | Product, Frontend, Backend, AWS, GitHub, Docs, QA |
| Owner | text or assignees | Human, Codex, Claude Code, Shared |
| Estimate | text or number | 15m, 30m, 1h, 2h, 1d |
| Target | date | optional release/verification target |
| Automation | single select | Manual, Codex, Claude, GitHub Actions |

## Initial Issues

Create these issues and add them to the project.

### P1: Verify GitHub Actions production secrets

Area: GitHub
Owner: Human
Estimate: 10-20m

Acceptance criteria:

- `AWS_ACCESS_KEY_ID` exists.
- `AWS_SECRET_ACCESS_KEY` exists.
- `AWS_REGION=ap-northeast-1`.
- `S3_BUCKET=veai-jp-toc-web`.
- `CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE`.
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_INR8bI3WX`.
- `NEXT_PUBLIC_COGNITO_CLIENT_ID=7ghfrdbrthuvi86if1orlktesn`.
- `NEXT_PUBLIC_API_URL=https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`.
- `NEXT_PUBLIC_AWS_REGION=ap-northeast-1`.

### P1: Decide release timing for merging development to main

Area: GitHub
Owner: Human
Estimate: 5-15m

Acceptance criteria:

- CI is green.
- `npm run smoke:prod` passes.
- Human owner is comfortable treating current MVP as the main branch state.

### P1: Run real-email Cognito sign-up smoke test

Area: QA
Owner: Human
Estimate: 15-30m

Acceptance criteria:

- Sign-up email/code arrives.
- User can confirm and sign in.
- User can create one care log.
- Page refresh does not break the experience.

### P2: Decide local-first vs AWS-first saving

Area: Product
Owner: Human
Estimate: 10-20m

Recommendation:

- Choose local-first for MVP.

Acceptance criteria:

- Decision is recorded in an issue comment or `docs/active-todo.md`.
- Implementation issue is created for Codex/Claude Code.

### P2: Implement selected storage sync behavior

Area: Frontend / Backend
Owner: Codex or Claude Code
Estimate: 1-3h

Acceptance criteria:

- Behavior matches the product decision.
- Signed-out behavior is clear.
- Signed-in sync has error handling.
- `npm run lint`, `npm run build`, `npm run smoke:backend`, and relevant manual checks pass.

### P2: Harden AWS infrastructure before real user data

Area: AWS
Owner: Codex or Claude Code
Estimate: 1-2h

Acceptance criteria:

- Cognito/DynamoDB removal policies are production-safe.
- CORS is narrowed where practical.
- Lambda log retention is explicit.
- Backend smoke test remains green.

## Labels

Create these labels:

```text
priority:P0
priority:P1
priority:P2
priority:P3
area:product
area:frontend
area:backend
area:aws
area:github
area:docs
area:qa
owner:human
owner:codex
owner:claude
status:blocked
```

## Manual Setup Steps

1. Open GitHub repository `larai-w/carequest`.
2. Create a new Project named `Care Quest MVP`.
3. Add the fields listed above.
4. Create the initial issues listed above.
5. Add each issue to the project.
6. Set `Priority`, `Area`, `Owner`, and `Estimate`.

## `gh` CLI Setup Path

If `gh` is installed later:

```bash
gh auth refresh -s project
gh project create --owner larai-w --title "Care Quest MVP"
gh project list --owner larai-w
```

To create the standard labels and initial issues:

```bash
scripts/github-issue-bootstrap.sh
```

After the project exists, add issues to it with:

```bash
gh project item-add PROJECT_NUMBER --owner larai-w --url ISSUE_URL
```

GitHub's current CLI project commands include project creation, field management, item creation, and item listing. For deeper automation, use the GraphQL API with a token that has `project` scope.

## Operating Rhythm

Weekly or before each work session:

1. Check `docs/active-todo.md`.
2. Check the GitHub Project board.
3. Pick the highest-priority `Ready` item.
4. Keep work in small PRs.
5. Move items to `Review` when a PR is pushed.
6. Move items to `Done` only after verification is recorded.
