#!/bin/bash
set -euo pipefail

REPO="${GITHUB_REPO:-larai-w/carequest}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install GitHub CLI and run: gh auth login"
  exit 1
fi

echo "Creating labels in ${REPO}"

labels=(
  "priority:P0|b60205|Highest priority"
  "priority:P1|d93f0b|High priority"
  "priority:P2|fbca04|Medium priority"
  "priority:P3|0e8a16|Low priority"
  "area:product|1d76db|Product decision"
  "area:frontend|5319e7|Frontend work"
  "area:backend|006b75|Backend work"
  "area:aws|ff9900|AWS infrastructure"
  "area:github|24292f|GitHub workflow"
  "area:docs|0075ca|Documentation"
  "area:qa|5319e7|Quality assurance"
  "owner:human|c5def5|Human-owned task"
  "owner:codex|bfd4f2|Codex-owned task"
  "owner:claude|d4c5f9|Claude Code-owned task"
  "status:blocked|000000|Blocked task"
)

for label in "${labels[@]}"; do
  IFS="|" read -r name color description <<< "${label}"
  gh label create "${name}" \
    --repo "${REPO}" \
    --color "${color}" \
    --description "${description}" \
    --force
done

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  if gh issue list --repo "${REPO}" --state all --search "${title} in:title" --json title --jq '.[].title' | grep -Fxq "${title}"; then
    echo "Issue already exists: ${title}"
    return
  fi

  gh issue create \
    --repo "${REPO}" \
    --title "${title}" \
    --label "${labels}" \
    --body "${body}"
}

create_issue \
  "[GitHub] Verify production Actions secrets" \
  "priority:P1,area:github,owner:human" \
  "Estimate: 10-20m

Acceptance criteria:
- [ ] AWS_ACCESS_KEY_ID exists.
- [ ] AWS_SECRET_ACCESS_KEY exists.
- [ ] AWS_REGION is ap-northeast-1.
- [ ] S3_BUCKET is veai-jp-toc-web.
- [ ] CLOUDFRONT_DISTRIBUTION_ID is E32Z6UIZTZD6DE.
- [ ] NEXT_PUBLIC_COGNITO_USER_POOL_ID is ap-northeast-1_INR8bI3WX.
- [ ] NEXT_PUBLIC_COGNITO_CLIENT_ID is 7ghfrdbrthuvi86if1orlktesn.
- [ ] NEXT_PUBLIC_API_URL is https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/.
- [ ] NEXT_PUBLIC_AWS_REGION is ap-northeast-1."

create_issue \
  "[Release] Decide when to merge development to main" \
  "priority:P1,area:github,owner:human" \
  "Estimate: 5-15m

Acceptance criteria:
- [ ] CI is green.
- [ ] npm run smoke:prod passes.
- [ ] Human owner approves current MVP as main branch state."

create_issue \
  "[QA] Run real-email Cognito sign-up smoke test" \
  "priority:P1,area:qa,owner:human" \
  "Estimate: 15-30m

Acceptance criteria:
- [ ] Sign-up email/code arrives.
- [ ] User can confirm and sign in.
- [ ] User can create one care log.
- [ ] Refresh keeps the app usable."

create_issue \
  "[Product] Decide local-first vs AWS-first saving" \
  "priority:P2,area:product,owner:human" \
  "Estimate: 10-20m

Recommendation: choose local-first for MVP.

Acceptance criteria:
- [ ] Decision is recorded.
- [ ] Follow-up implementation issue is confirmed or updated."

create_issue \
  "[App] Implement selected storage sync behavior" \
  "priority:P2,area:frontend,area:backend,owner:codex" \
  "Estimate: 1-3h

Acceptance criteria:
- [ ] Behavior matches product decision.
- [ ] Signed-out behavior is clear.
- [ ] Signed-in sync has error handling.
- [ ] npm run lint passes.
- [ ] npm run build passes.
- [ ] npm run smoke:backend passes."

create_issue \
  "[AWS] Harden infrastructure before real user data" \
  "priority:P2,area:aws,owner:codex" \
  "Estimate: 1-2h

Acceptance criteria:
- [ ] Cognito removal policy is production-safe.
- [ ] DynamoDB removal policy is production-safe.
- [ ] CORS is narrowed where practical.
- [ ] Lambda log retention is explicit.
- [ ] npm run smoke:backend passes."

echo
echo "Issues and labels are ready."
echo "Next: create a GitHub Project named 'Care Quest MVP' and add these issues to it."
echo "If gh project is available with project scope, start with:"
echo "  gh auth refresh -s project"
echo "  gh project create --owner larai-w --title 'Care Quest MVP'"

