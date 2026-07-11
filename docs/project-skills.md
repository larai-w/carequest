# Care Quest project skills

Last updated: 2026-07-06 JST

This document turns the skills needed for Care Quest into reusable project assets. Use it when onboarding Codex, Claude Code, a human contributor, or a future maintainer.

## Skill Map

| Skill | Why it matters | Current project surface | Minimum working level |
| --- | --- | --- | --- |
| Next.js 16 App Router | The app is built with Next.js 16 and has changed APIs/conventions. | `app/`, `components/`, `next.config.ts` | Read `node_modules/next/dist/docs/` before code changes. Know static export and `basePath`. |
| React 19 | UI components and client-side state use React. | `app/*`, `components/*` | Build accessible components, manage client state, avoid hydration issues. |
| TypeScript | App, infra, and shared types are TypeScript. | `lib/*.ts`, `infra/lib/*.ts` | Keep types strict enough to catch data-shape drift. |
| Frontend UX for caregivers | The product serves family caregivers, so friction and tone matter. | All pages | Prioritize low-friction flows, calm copy, local-first behavior. |
| Static web deployment | Production is a static export under `/carequest/`. | `next.config.ts`, `out/`, `scripts/deploy-static.sh` | Understand `output: "export"`, trailing slash, CloudFront URL rewriting. |
| AWS CLI | Production verification and deploy use AWS CLI. | `scripts/aws-status.sh`, `scripts/deploy-static.sh` | Safely run read-only checks and targeted S3/CloudFront deploys. |
| AWS CDK | Cognito, API Gateway, Lambda, and DynamoDB are CDK-managed. | `infra/` | Run synth/build/deploy, review CloudFormation output before deploy. |
| Cognito | User auth and email verification use Cognito. | `lib/amplify.ts`, `components/AuthPanel.tsx`, CDK stack | Verify sign-up/sign-in and token use. |
| API Gateway + Lambda | Backend API handles health and care entries. | `infra/lambda/entries/index.js`(ハンドラー), `infra/lib/carequest-stack.ts`(CDK 定義), `lib/api.ts`(フロント) | Debug Lambda runtime errors and API Gateway integration issues. |
| DynamoDB | Care entries are stored by user partition key. | CDK table, Lambda handler | Understand `pk/sk`, query patterns, and item shape mapping. |
| CloudFront + S3 | Production URL is served through existing `veai.jp` distribution. | `docs/deploy.md`, `scripts/deploy-static.sh` | Know that `/carequest/` is served from `veai-jp-toc-web/carequest/`. |
| GitHub Actions | CI and production deploy are workflow-driven. | `.github/workflows/*` | Verify CI, secrets, and deploy behavior. |
| GitHub Projects / Issues | Ongoing project management should live in GitHub. | `docs/project-management.md`, issue templates | Track work as issues and project items with status/priority/owner. |
| Security / least privilege | Secrets, IAM, CORS, and destructive removal policies need care. | AWS, GitHub Secrets, CDK | Avoid broad credentials; harden before real user data. |

## Required Checks Before Code Changes

Run these before handing work to another agent:

```bash
git status --short --branch
npm run lint
npm test
npm run build
cd infra && npm run build
cd infra && npm test
cd infra && npm run synth
```

For production/AWS work:

```bash
npm run aws:status
npm run smoke:backend
npm run smoke:prod
```

## Next.js 16 Rule

This repo has an `AGENTS.md` rule that says this is not the Next.js version an agent may remember from training data. Before touching app code, read the relevant docs under:

```text
node_modules/next/dist/docs/
```

Relevant topics for this project:

- App Router
- Static export
- `basePath`
- client components
- metadata/layout behavior
- deployment output changes

## AWS Skill Notes

Current production routing:

- Public URL: `https://veai.jp/carequest/`
- S3 bucket used for production static files: `veai-jp-toc-web`
- Prefix: `carequest/`
- CloudFront distribution: `E32Z6UIZTZD6DE`
- Invalidation path: `/carequest/*`

Important constraint:

- Adding a dedicated `/carequest/*` cache behavior was rejected because the CloudFront distribution is on the Free pricing plan and already hit the cache behavior limit.
- Do not try to re-add a dedicated behavior unless the plan/limit changes.

Backend:

- Stack: `CareQuestStack`
- Region: `ap-northeast-1`
- API URL: `https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`
- Health smoke: `npm run smoke:backend`

## Product Skill Notes

Care Quest should feel low-pressure and supportive. Default product direction:

- Prefer local-first recording for MVP.
- Use AWS sync as an enhancement, not a blocker, unless the product decision changes.
- Avoid making a caregiver sign in before they can record what happened today.

## Project Management Skill Notes

Use GitHub Issues as the source of truth for tasks and GitHub Projects as the planning view. A task should have:

- status
- priority
- area
- owner
- estimate
- clear acceptance criteria

See [project-management.md](project-management.md) for the recommended project setup.

