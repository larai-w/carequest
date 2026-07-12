#!/bin/bash
set -euo pipefail

# Creates the GitHub Project (Projects v2), fields, labels, and current task
# issues, then adds all open issues to the project.
#
# Prerequisites:
#   gh auth login
#   gh auth refresh -s project
#
# Usage (owner/repo are overridable so any user can run this):
#   GITHUB_OWNER=your-name GITHUB_REPO=your-name/carequest bash scripts/github-project-bootstrap.sh

OWNER="${GITHUB_OWNER:-larai-w}"
REPO="${GITHUB_REPO:-larai-w/carequest}"
PROJECT_TITLE="${PROJECT_TITLE:-Care Quest MVP}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install GitHub CLI and run: gh auth login" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not authenticated. Run: gh auth login && gh auth refresh -s project" >&2
  exit 1
fi

echo "== Labels and base issues (idempotent) =="
GITHUB_REPO="${REPO}" bash "$(dirname "$0")/github-issue-bootstrap.sh"

echo "== Project =="
project_number="$(gh project list --owner "${OWNER}" --format json --jq \
  ".projects[] | select(.title == \"${PROJECT_TITLE}\") | .number" | head -1)"

if [ -z "${project_number}" ]; then
  gh project create --owner "${OWNER}" --title "${PROJECT_TITLE}"
  project_number="$(gh project list --owner "${OWNER}" --format json --jq \
    ".projects[] | select(.title == \"${PROJECT_TITLE}\") | .number" | head -1)"
  echo "Created project #${project_number}"
else
  echo "Project already exists: #${project_number}"
fi

echo "== Fields =="
existing_fields="$(gh project field-list "${project_number}" --owner "${OWNER}" --format json --jq '.fields[].name')"

create_field() {
  local name="$1"
  local options="$2"
  if echo "${existing_fields}" | grep -Fxq "${name}"; then
    echo "Field already exists: ${name}"
    return
  fi
  gh project field-create "${project_number}" --owner "${OWNER}" \
    --name "${name}" --data-type SINGLE_SELECT --single-select-options "${options}"
}

create_field "Priority" "P0,P1,P2,P3"
create_field "Area" "Product,Frontend,Backend,AWS,GitHub,Docs,QA"
create_field "Owner" "Human,Claude Planner,Claude Worker,Shared"
create_field "Model" "Fable,Opus,Sonnet,Human"

echo "== Task issues (docs/task-list.md 2026-07-09 batch) =="

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  if gh issue list --repo "${REPO}" --state all --search "${title} in:title" --json title --jq '.[].title' | grep -Fxq "${title}"; then
    echo "Issue already exists: ${title}"
    return
  fi

  gh issue create --repo "${REPO}" --title "${title}" --label "${labels}" --body "${body}"
}

create_issue \
  "[AWS] Harden CDK stack before real user data (T6)" \
  "priority:P1,area:aws,owner:claude" \
  "Delegate to: carequest-worker (model: sonnet). Human approves deploy.

Acceptance criteria:
- [ ] Cognito/DynamoDB removal policies are production-safe (RETAIN).
- [ ] CORS narrowed to https://veai.jp where practical.
- [ ] Lambda log retention is explicit.
- [ ] cd infra && npm run build && npm run synth pass.
- [ ] Human reviews synth diff and runs deploy."

create_issue \
  "[App] Rest mode UI (T7 / US-302)" \
  "priority:P2,area:frontend,owner:claude" \
  "Delegate to: carequest-worker (model: sonnet).

Acceptance criteria:
- [ ] restMode can be toggled from home.
- [ ] Rest mode shows a gentle, guilt-free screen. No streaks anywhere.
- [ ] Copy follows .claude/skills/carequest-product-tone.
- [ ] npm run lint && npm run build pass."

create_issue \
  "[App] Custom care tasks (T8 / US-104)" \
  "priority:P2,area:frontend,owner:claude" \
  "Delegate to: carequest-worker (model: sonnet).

Acceptance criteria:
- [ ] User can add a custom task (title only) that earns points.
- [ ] Custom tasks persist in localStorage and appear on quest screen.
- [ ] Default gentle description is applied.
- [ ] npm run lint && npm run build pass."

create_issue \
  "[App] Service worker offline support (T9 / US-301)" \
  "priority:P2,area:frontend,owner:claude" \
  "Delegate to: carequest-worker (model: opus). basePath + static export is tricky.

Acceptance criteria:
- [ ] App shell works offline under /carequest/.
- [ ] SW registers only in production paths and never breaks non-SW browsers.
- [ ] Update flow does not serve stale HTML after deploys (versioned cache).
- [ ] npm run lint && npm run build pass; out/ inspected."

create_issue \
  "[App] Local-to-AWS sync on sign-in (T10 / US-103)" \
  "priority:P1,area:frontend,area:backend,owner:claude" \
  "Delegate to: carequest-worker (model: opus). Blocked by human product decision (local-first) and Cognito smoke test.

Acceptance criteria:
- [ ] On sign-in, local logs merge to AWS without duplicates.
- [ ] Sync failure keeps local data and shows a calm message.
- [ ] Signed-out state clearly says records are on this device only.
- [ ] npm run lint && npm run build && npm run smoke:backend pass."

echo "== Adding open issues to project =="
for url in $(gh issue list --repo "${REPO}" --state open --json url --jq '.[].url'); do
  gh project item-add "${project_number}" --owner "${OWNER}" --url "${url}" >/dev/null \
    && echo "Added ${url}" || echo "Skip (maybe already added): ${url}"
done

echo "Done. Project: https://github.com/users/${OWNER}/projects/${project_number}"
