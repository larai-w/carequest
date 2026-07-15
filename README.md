# Care Quest

**A local-first care-record companion for family caregivers — live at [veai.jp/carequest](https://veai.jp/carequest/).**

Records a care session in under 10 seconds with no account required. Data lives in `localStorage`; cloud backup is opt-in via Amazon Cognito.

---

## What it does

Care Quest lets family caregivers log daily care activities through a single tap — no typing required. It tracks energy levels, rest-mode days, and a weekly look-back, and surfaces a gentle prompt to a support helpline when low-energy days accumulate. The "Tomoshibi" (Candlelight) widget shows how many caregivers recorded today, using live aggregated data, so no caregiver feels alone.

**Status:** Live — https://veai.jp/carequest/

---

## Architecture

```
Browser (PWA / localStorage)
  │
  ├─ Next.js 16 (static export, basePath: /carequest)
  │     └─ Tailwind CSS 4 · TypeScript 5
  │
  ├─ Service Worker  (offline support; git-SHA version injected at build)
  │
  └─ AWS CloudFront  ──  S3 (veai-jp-toc-web/carequest/)
          │
          └─ [optional, sign-in only]
               API Gateway  ──  Lambda  ──  DynamoDB
               Amazon Cognito (user pool auth)

IaC: AWS CDK v2  (infra/)
  Resources synthesized: Cognito UserPool, DynamoDB Table (PITR on),
  API Gateway (Cognito authorizer, throttle 10 rps / burst 20),
  Lambda, 2× CloudWatch Alarms, AWS Budget ($10/mo)
```

Data is always written to `localStorage` first. Cognito sign-in enables cloud sync and cross-device restore — it is never required to use core features.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (static export) |
| Language | TypeScript 5, React 19 |
| Styling | Tailwind CSS 4 |
| Auth / Sync | Amazon Cognito + `aws-amplify` v6 |
| IaC | AWS CDK v2 (`aws-cdk-lib ^2.177`) |
| Unit tests | Vitest 4 |
| E2E tests | Playwright |
| CI | GitHub Actions |

---

## Testing

```
lib/__tests__/   — 16 Vitest unit test files
                   (api, backup, backup-reminder, contacts, date,
                    export, goodThings, import, logs, messages,
                    presence, stats, storage, support, sync)
e2e/             — 3 Playwright spec files (smoke, features, data-operations)
                   covering record creation, rest-mode toggle,
                   JSON export/import, onboarding, data reset,
                   backup-reminder boundary conditions
infra/test/      — 1 Vitest CDK assertions file
                   (Cognito, DynamoDB PITR, API Gateway Cognito auth,
                    throttling, CloudWatch alarms, Lambda asset packaging,
                    AWS Budget)
```

Run unit tests: `npm test`  
Run E2E tests: `npm run test:e2e` (requires a running dev server)  
Run infra tests: `cd infra && npm test`

---

## Local Development

```bash
npm install
npm run dev          # http://localhost:3000/carequest
npm test             # unit tests
npm run test:e2e     # Playwright E2E

# IaC
cd infra
npm install
npm test             # CDK assertions
npm run synth        # synthesize CloudFormation template
```

---

## Deployment

`main` branch push triggers GitHub Actions:

1. `audit → lint → test → build` (Next.js static export to `out/`)
2. Service Worker version injected (`postbuild` hook, git SHA + date)
3. `aws s3 sync out/ s3://veai-jp-toc-web/carequest/`
4. CloudFront cache invalidation on `/carequest/*`

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, Cognito pool IDs.  
See [docs/deploy.md](docs/deploy.md) for full setup.

A synthetic health check runs every 6 hours via GitHub Actions.

---

## Repository Layout

```
app/           Next.js App Router pages
components/    React UI components
lib/           Business logic + __tests__/
e2e/           Playwright specs
infra/         AWS CDK stack (TypeScript)
scripts/       Deploy, smoke-check, SW version injection
public/        PWA icons + service worker
docs/          Strategy, design principles, runbook, risk register
```

---

## 日本語

Care Quest は、家族介護者が「今日できたこと」をやさしく記録する Web アプリです。登録不要・広告なし・完全無料。記録はデバイスの localStorage に保存され、任意でクラウドバックアップが可能です。詳細なビジョンや設計原則は [docs/strategy.md](docs/strategy.md) および [docs/design-principles.md](docs/design-principles.md) を参照してください。

---

## License

MIT — see [LICENSE](LICENSE).

Part of the [VEAI LAB.](https://veai.jp) ecosystem — [Care Quest product page](https://veai.jp/apps/carequest/)
