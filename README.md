# Care Quest

**A local-first care-record companion for family caregivers — live at [veai.jp/carequest](https://veai.jp/carequest/).**

Records a care session in under 10 seconds with no account required. Data lives in `localStorage`; cloud backup is opt-in via Amazon Cognito.

> **Care Quest is not a medical device.** It records what a family caregiver chooses to
> log. It does not diagnose, does not decide whether care or medication is needed, and is
> not a substitute for professional judgement. For anything urgent, contact a healthcare
> provider or emergency services.

---

## What it does

Care Quest lets family caregivers log daily care activities through a single tap — no typing required. It tracks energy levels, rest-mode days, and a weekly look-back, and surfaces a gentle prompt to a support helpline when low-energy days accumulate. The "Tomoshibi" (Candlelight) widget shows an aggregate count of caregivers who synced records today, without displaying their individual records.

Mistakes are recoverable without confirmation dialogs: right after recording, undoing, or removing a record (or a custom task), an "元に戻す" (restore) button appears. If the same care item is logged twice within a few minutes, the confirmation card says so. A record that could not be saved to the device is never shown as saved.

**Status:** Live — https://veai.jp/carequest/

### Product metadata

[`product.json`](./product.json) is the public product manifest consumed by VEAI.jp. Update it when
CareQuest's public availability, URLs, descriptions, capabilities, or boundaries change. The unit
test suite verifies the manifest's core contract.

### Open-source collaboration

- **Home Assistant** — **Merged** PR: [Accessible names for analytics consent switches](https://github.com/home-assistant/frontend/pull/54083)
- **Microduck** — **Merged** PR: [Fresh camera snapshots through robotctl and console HTTP](https://github.com/pollen-robotics/microduck/pull/241)
- **stack-chan** — **In review** PR: [Deterministic sample sync for gallery output](https://github.com/stack-chan/stack-chan/pull/702)

### Contributing

Contributions are welcome. See [CONTRIBUTING](./CONTRIBUTING.md).

- Quick start for first contributions: open an issue with the [Good first issue](https://github.com/larai-w/carequest/issues/new/choose) template.
- For code changes, open a pull request from [Compare changes](https://github.com/larai-w/carequest/compare).

---

## Keeping a copy of records

Logging and looking back at records work without an account. Cloud backup and cross-device restore
require signing in. For a local copy, export JSON from the reflection screen; that file can be
imported into CareQuest on another device. CSV is for reviewing records in a spreadsheet and is
not an app-restore format. Check that a cloud backup completed or keep a JSON copy before switching devices.

What cloud backup covers, and how it behaves:

- **Care records only.** Reflection notes, "good things", energy history, and custom tasks stay on
  the device. Use the JSON export to move everything.
- **Last backup time is shown** in the account panel and on the reflection screen, instead of
  assuming the backup succeeded. Messages after sign-in say what actually happened (backed up,
  failed, or nothing to back up).
- **Undoing or removing a record also removes its cloud copy.** If the device is offline, the
  deletion is retried on the next sync, and restores never bring an undone record back.
- **Deleting cloud records pauses automatic backup**, so the next record does not re-upload
  everything. Pressing "クラウドにバックアップ" on the reflection screen resumes it.
- **Shared devices are kept apart.** The device remembers (as a hash, not the account name) which
  account its records were backed up under. If a different account signs in, CareQuest does not
  upload records, restore into the device, or remove individual cloud records until the person
  confirms the device's records are theirs.

Browser storage can be lost when its data is cleared or the device is lost. Keep a backup somewhere
accessible outside that device. Exported files contain your records; clearing browser data does not
remove those files or copies you have shared.

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
lib/__tests__/   — Vitest unit tests: storage and import sanitizing, cloud sync
                   (backup, restore, per-record cloud deletes, device-owner
                   checks, auto-backup pause), user-facing messages and wording,
                   stats, date handling
e2e/             — Playwright specs: record creation, undo/restore flows,
                   save-failure handling, rest mode, JSON export/import,
                   onboarding, data reset, backup reminders
infra/test/      — Vitest: CDK assertions (Cognito, DynamoDB PITR and deletion
                   protection, API Gateway Cognito auth and throttling,
                   alarms, budget) and the entries Lambda handler
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

Care Quest は、家族介護者が「今日できたこと」をやさしく記録する Web アプリです。登録不要・広告なし・完全無料。記録はデバイスの localStorage に保存され、任意でクラウドバックアップが可能です。クラウドに控えるのはケアの記録だけで、メモなどを含めて全部を別の端末へ移すときは JSON で保存します。記録や取り消しは、直後に「元に戻す」で戻せます。詳細なビジョンや設計原則は [docs/design-principles.md](docs/design-principles.md) を参照してください。

---

## License

MIT — see [LICENSE](LICENSE).

Part of the [VEAI LAB.](https://veai.jp) ecosystem — [Care Quest product page](https://veai.jp/apps/carequest/)
