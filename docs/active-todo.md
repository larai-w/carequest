# Care Quest active TODO

Last verified: 2026-07-06 JST

This document is the handoff point for human work, Codex work, and Claude Code work.
Start here after a new session begins.

## Next recommended action

Recommended next action:

1. Verify GitHub Actions repository secrets, especially `S3_BUCKET=veai-jp-toc-web`.
2. Decide when to merge `development` to `main`.
3. Run an authenticated Cognito sign-up/sign-in smoke test when you have a test email ready.

Production routing and static deployment are done. `https://veai.jp/carequest/` now serves from `s3://veai-jp-toc-web/carequest/` through the existing CloudFront default behavior.

Estimated human time now: 25-55 minutes, mostly GitHub secret verification, release timing, and real-email sign-up testing.

## Human TODO Notes

These are the remaining tasks that most likely need you because they involve GitHub admin access, release judgment, or a real email inbox.

### 1. Verify GitHub Actions secrets

- Estimated time: 10-20 minutes
- Where: GitHub repository -> Settings -> Secrets and variables -> Actions -> Repository secrets
- What to check:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION=ap-northeast-1`
  - `S3_BUCKET=veai-jp-toc-web`
  - `CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE`
  - `NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_INR8bI3WX`
  - `NEXT_PUBLIC_COGNITO_CLIENT_ID=7ghfrdbrthuvi86if1orlktesn`
  - `NEXT_PUBLIC_API_URL=https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`
  - `NEXT_PUBLIC_AWS_REGION=ap-northeast-1`
- Note: Codex cannot currently verify these because the `gh` CLI is not installed in this environment and GitHub repository secrets cannot be read back in plaintext anyway.
- Codex can see GitHub Actions run status through the connected GitHub app, but it cannot inspect repository secret values.
- Completion criteria: secret names exist, and `S3_BUCKET` is definitely `veai-jp-toc-web`, not `veai-jp-carequest-prod`.

### 2. Decide when to merge `development` to `main`

- Estimated time: 5-15 minutes
- Where: GitHub PR/branch UI, or ask Codex/Claude Code to do it if GitHub tooling is available later
- What to check:
  - Current production URL works: `https://veai.jp/carequest/`
  - CI passes on the branch/PR
  - You are comfortable making the current MVP the `main` branch state
- Note: Codex can prepare the commit/PR later, but you should decide the release timing.
- Current local changes have been committed and pushed to `development` as `a004e0d7bf03bbba91d45736230b478d72ab49f5`.

### 3. Cognito sign-up/sign-in smoke test with a real email

- Estimated time: 15-30 minutes
- Where: `https://veai.jp/carequest/`
- What to test:
  - Sign up with an email you can receive
  - Confirm the verification email/code arrives
  - Sign in
  - Create one care log
  - Confirm the app still feels usable after refresh
- Note: Codex can create an admin test user and call APIs, but only you can conveniently confirm a real email delivery flow.

### 4. Product decision: local-first or AWS-first saving

- Estimated time: 10-20 minutes
- Decision to make:
  - Local-first: keep saving immediately to browser storage and sync to AWS when signed in.
  - AWS-first: require sign-in for durable cloud saving.
- Recommendation for this MVP: local-first. It keeps the care recording experience low-friction and avoids blocking a caregiver when auth/email is inconvenient.
- After you decide: Codex/Claude Code can implement the selected behavior.

Human total remaining estimate: 25-55 minutes for release readiness, plus 10-20 minutes later for the storage product decision.

## Current status

- Branch: `development`
- Working tree at verification time: has intentional uncommitted documentation, automation, and Lambda runtime fix changes
- App: Next.js static export with `basePath: "/carequest"`
- Production target: `https://veai.jp/carequest/`
- AWS region: `ap-northeast-1`
- AWS identity verified locally: account `339712703146`
- CDK stack: `CareQuestStack`
- CDK stack status: `UPDATE_COMPLETE`
- Last CDK deploy: 2026-07-06, Lambda runtime fix deployed
- CDK outputs:
  - Cognito User Pool ID: `ap-northeast-1_INR8bI3WX`
  - Cognito Client ID: `7ghfrdbrthuvi86if1orlktesn`
  - API URL: `https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`
  - DynamoDB table: `CareQuestStack-CareQuestEntriesTableDDEC3FF5-1AT7RUT3T6UQM`
- Production S3 deploy bucket: `veai-jp-toc-web`
- Original isolated bucket exists but is not used for current production routing: `veai-jp-carequest-prod`
- `veai-jp-toc-web` bucket policy already allows CloudFront distribution `E32Z6UIZTZD6DE` to read objects
- CloudFront distribution checked: `E32Z6UIZTZD6DE`
- API health: `200 {"status":"ok"}`
- Production static deploy: complete
- CloudFront invalidation: `I6OSO6N4MVWFM9GEO5SBI57Y2L`, completed
- Previous GitHub CI for remote HEAD `70ada26dae7ca3d98975740d0533e80e1f25da16`: success
- Current committed/pushed HEAD: `a004e0d7bf03bbba91d45736230b478d72ab49f5`
- GitHub connector note: the available workflow-run tool returns PR-triggered runs only, so the push-triggered run for `a004e0d7bf03bbba91d45736230b478d72ab49f5` was not visible through that connector at verification time.
- Production smoke tests:
  - `https://veai.jp/carequest/`: `200`
  - `https://veai.jp/carequest`: `200`
  - `https://veai.jp/carequest/quest/`: `200`
  - `https://veai.jp/carequest/community/`: `200`
  - `https://veai.jp/carequest/reflection/`: `200`
  - `https://veai.jp/carequest/_next/static/chunks/3e_9087qsg0yq.css`: `200`

## Verification already done

Run from repo root unless noted.

```bash
npm run lint
npm run build
cd infra && npm run build
cd infra && npm run synth
aws sts get-caller-identity
aws cloudformation describe-stacks --stack-name CareQuestStack --region ap-northeast-1
aws s3api head-bucket --bucket veai-jp-toc-web --region ap-northeast-1
aws cloudfront get-distribution-config --id E32Z6UIZTZD6DE
curl -s -i https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/health
```

Results:

- `npm run lint`: pass
- `npm run build`: pass when run outside the Codex sandbox. The sandboxed run failed because Next.js 16/Turbopack attempted to bind a local port while processing CSS.
- Infra TypeScript build: pass
- CDK synth: pass
- AWS credentials: configured and valid
- `CareQuestStack`: already deployed
- Production S3 bucket: exists
- API health: pass after fixing the Lambda runtime dependency issue

## Done by Codex on 2026-07-06

- Added this active TODO/handoff document.
- Added `npm run aws:status`.
- Added `npm run deploy:static`.
- Fixed the deployed API Lambda 502 caused by `require("aws-sdk")` on Node.js 20.
- Deployed the Lambda fix with CDK.
- Verified `GET /health` now returns `200`.
- Tried to add a dedicated CloudFront behavior for `/carequest/*`; AWS rejected it due to the Free pricing plan behavior limit.
- Removed the unused bucket policy and OAC created during that rejected CloudFront attempt.
- Switched the production deploy plan to the existing default origin bucket `veai-jp-toc-web`.
- Deployed the static site to `s3://veai-jp-toc-web/carequest/`.
- Invalidated `/carequest/*`.
- Verified production URLs return `200`.
- Added `npm run smoke:prod`.
- Verified `.env.local` public AWS values match the CDK outputs.
- Checked GitHub Actions status for the current remote HEAD; CI is passing.

## Important finding

The checked CloudFront distribution currently has aliases for `veai.jp` and `www.veai.jp`. It already uses `veai-jp-toc-web` as the default S3 origin and attaches `veai-url-rewrite` on viewer requests.

CloudFront rejected adding a new `/carequest/*` behavior with:

```text
Distributions with the Free pricing plan can't have the following features: More than 5 cache behaviors
```

Therefore the current production path should use the existing default origin instead of adding a dedicated behavior.

## Time estimates

These are practical estimates for elapsed working time, assuming AWS/GitHub access is available.

| Priority | Task | Owner | Estimated time | Can Codex automate? | Notes |
| --- | --- | --- | ---: | --- | --- |
| P0 | Decide CloudFront routing approach for `/carequest/*` | Done | 0 min | Done | Use default origin `veai-jp-toc-web` due CloudFront behavior limit. |
| P0 | Add CloudFront origin/behavior and S3 bucket policy | Not needed | 0 min | Not needed | Dedicated behavior was rejected by AWS Free pricing plan. |
| P0 | Deploy static site to S3 and invalidate CloudFront | Done | 0 min | Done | Deployed to `veai-jp-toc-web/carequest/`. |
| P0 | Production smoke test for `https://veai.jp/carequest/` | Done | 0 min | Done | Key URLs returned `200`. |
| P1 | Add/verify GitHub Actions secrets | Human | 10-20 min | No | GitHub UI or admin access required unless GitHub CLI/app permissions are configured. |
| P1 | Commit current local changes | Done | 0 min | Done | Pushed to `development` as `a004e0d7bf03bbba91d45736230b478d72ab49f5`. |
| P1 | Merge `development` to `main` after CI | Human or Codex | 5-15 min | Partly | Human should decide when production release is acceptable. |
| P1 | Cognito sign-up/sign-in UI smoke test | Human or Codex | 15-30 min | Partly | Human can use a real email; Codex can create admin test users if approved. |
| P2 | Local-first vs AWS write-through decision | Human | 10-20 min | No | Product behavior decision. |
| P2 | Implement selected storage sync behavior | Codex/Claude Code | 1-3 hr | Yes | Depends on the product decision. |
| P2 | Infrastructure hardening | Codex/Claude Code | 1-2 hr | Yes | Best done before real user data matters. |

## Human-only or human-led work

- Approve the CloudFront routing approach because the distribution is shared with other production paths.
- Add or verify GitHub repository secrets if Codex does not have GitHub admin access.
- Decide when `development` is safe to merge to `main`.
- Decide whether the app should stay local-first or require AWS sync after sign-in.
- Use a real email address for a Cognito end-to-end sign-up test, unless you want Codex to create an admin test user.

Total human time before first production release: about 25-55 minutes.

## Codex/Claude Code work still available

- Create a temporary Cognito test user and test authenticated `/entries` calls if approved.
- Harden CDK removal policies, CORS, and log retention.
- Implement AWS-backed storage sync after the product decision.

## Priority TODO

### P0 - Production routing

- [x] Decide routing approach: use existing default origin bucket `veai-jp-toc-web`.
- [x] Confirm a dedicated CloudFront behavior cannot be added under the current Free pricing plan behavior limit.
- [x] Confirm the selected S3 origin has OAC read permission.
- [x] Confirm the existing `veai-url-rewrite` CloudFront Function handles `/carequest/`, `/carequest`, and nested static export paths correctly.
- [x] Invalidate `/carequest/*` after deployment.
- [x] Smoke test:

```bash
curl -I https://veai.jp/carequest/
curl -I https://veai.jp/carequest/_next/
```

Do not update this CloudFront distribution casually. It is shared with existing `veai.jp`, `/ready/*`, `/gutpacer/*`, and `/api/*` traffic.

### P1 - GitHub Actions production deploy

- [ ] Add or verify repository secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION=ap-northeast-1`
  - `S3_BUCKET=veai-jp-toc-web`
  - `CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE`
  - `NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_INR8bI3WX`
  - `NEXT_PUBLIC_COGNITO_CLIENT_ID=7ghfrdbrthuvi86if1orlktesn`
  - `NEXT_PUBLIC_API_URL=https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`
  - `NEXT_PUBLIC_AWS_REGION=ap-northeast-1`
- [ ] Confirm the deploy IAM user is scoped to only the production bucket path and CloudFront invalidation.
- [x] Commit current local changes.
- [ ] Merge `development` to `main` after CI passes.
- [ ] Confirm `.github/workflows/deploy-prod.yml` uploads to the same bucket/origin that CloudFront actually serves.

### P1 - AWS backend smoke test

- [x] Confirm unauthenticated `GET /health` returns `200`.
- [ ] Create a Cognito test user or use self sign-up from the UI.
- [ ] Confirm email verification works.
- [ ] Sign in from the app.
- [ ] Create at least one care log.
- [ ] Confirm `POST /entries` writes a row to DynamoDB.
- [ ] Confirm `GET /entries` returns only the signed-in user's rows.

Useful commands:

```bash
aws cloudformation describe-stacks --stack-name CareQuestStack --region ap-northeast-1
aws dynamodb scan --table-name CareQuestStack-CareQuestEntriesTableDDEC3FF5-1AT7RUT3T6UQM --region ap-northeast-1 --limit 5
curl -s https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/health
npm run smoke:backend
```

### P2 - App integration polish

- [ ] Verify `.env.local` has the same public AWS values as the CDK outputs.
- [ ] Check whether `lib/storage.ts` should remain local-first or write-through to AWS after sign-in.
- [ ] Improve the signed-out state UX if API sync is enabled.
- [ ] Confirm `fetchCareEntries()` maps DynamoDB records back into the exact `CareLog` shape expected by UI components.
- [ ] Decide whether the API should accept only server-derived `userId` and ignore client-provided `userId`.

### P2 - Infrastructure hardening

- [ ] Change destructive development defaults before production data matters:
  - Cognito User Pool `removalPolicy`
  - DynamoDB table `removalPolicy`
- [ ] Consider moving the inline Lambda code out of `infra/lib/carequest-stack.ts`.
- [ ] Narrow CORS from `*` to expected origins once production routing is final.
- [ ] Add CloudWatch log retention.
- [ ] Add a lightweight backend integration test or scripted smoke test.

## Automation available now

### Local validation

```bash
npm run lint
npm run build
cd infra && npm run build
cd infra && npm run synth
```

### AWS deploy through CDK

The existing script deploys Cognito/API/Lambda/DynamoDB:

```bash
npm run aws:setup
```

Use this only when you intend to update AWS infrastructure. It runs:

```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy --require-approval never
```

### Static site deployment

Use the scripted production static deploy:

```bash
npm run deploy:static
```

### Read-only AWS status

```bash
AWS_REGION=ap-northeast-1 \
S3_BUCKET=veai-jp-toc-web \
CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE \
npm run aws:status
```

### Backend smoke test

```bash
npm run smoke:backend
```

### Production smoke test

```bash
npm run smoke:prod
```

Current result: pass for `/carequest/`, `/carequest`, `/carequest/quest/`, `/carequest/community/`, and `/carequest/reflection/`.

## Session restart checklist

1. Read this file first.
2. Run `git status --short --branch`.
3. Run `npm run lint`.
4. Run `npm run build` outside restricted sandboxes if Turbopack reports a port binding error.
5. Run `cd infra && npm run synth`.
6. If doing AWS work, run `npm run aws:status` and compare with the status section above.
7. Work the highest unchecked priority item.
8. Update this file with what changed, what was verified, and what remains.
