# Care Quest

**A local-first care-record companion for family caregivers.**

[Open the app](https://veai.jp/carequest/) · [日本語](README.ja.md) · [Local development](#local-development) · [Contributing](CONTRIBUTING.md)

Record care activities without an account. Data lives in browser `localStorage`; cloud backup is opt-in via Amazon Cognito. The application UI is in Japanese. This repository provides the TypeScript frontend, AWS CDK infrastructure and automated checks. It does not include a trained ML model or a clinical prediction service.

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
  the device. Use the JSON export for the broader app state; device-local reminder flags retain their destination values during import. Account sessions and every browser preference are not a portable backup.
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
  └─ AWS CloudFront  ──  S3 (configured bucket / carequest/)
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

## Local Development

Use **Node.js 24** (matching CI), npm, and Git. Python 3 is needed for the public-content guard. Start from a fresh checkout without production environment files.

```bash
git clone https://github.com/larai-w/carequest.git
cd carequest
npm ci
npm run dev
```

Open **http://localhost:3000/carequest/**. The `/carequest` base path is configured in [next.config.ts](next.config.ts). No AWS credentials or account are needed for local recording. Stop the server with `Ctrl+C`.

### Try the local flow

Use invented examples in a separate browser profile:

1. Complete the introductory screen and record a sample care task.
2. Use the immediate **元に戻す** action to reverse the change.
3. Open the reflection screen, export JSON and CSV, and compare their contents.
4. Reload to see the locally retained state. Import JSON in another isolated browser profile to explore restoration.

These steps describe the implemented flow, not a measured usability result. Device storage and downloaded files can contain sensitive data when used with real records.

### Optional cloud configuration

Leave these values unset for the local-only flow. To connect to **your own isolated development resources**, supply them in a Git-ignored `.env.local`:

```dotenv
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-development-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-development-app-client-id
NEXT_PUBLIC_API_URL=https://your-development-api.example.invalid
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
```

These placeholders do not create a backend. The `NEXT_PUBLIC_` values are embedded in the browser bundle: never use them for AWS keys, client secrets or tokens. See [Amplify initialization](lib/amplify.ts), [API calls](lib/api.ts), and the [CDK stack](infra/lib/carequest-stack.ts). Setting a real API URL enables network-backed features, including optional feedback and aggregate presence; local-first does not mean all interactions are network-free.

### Static output

```bash
npm run build
```

The export is written to `out/`; `postbuild` injects a service-worker version. This project uses static export. `npm start` maps to `next start` and is not the serving path for the exported site. Use `npm run dev` for development; a static host must serve the export under `/carequest/` with the corresponding asset paths.

## Testing

The commands below are entry points to the existing checks, not a claim about their latest run:

```bash
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

[Playwright configuration](playwright.config.ts) starts the development server automatically on port 3000, or reuses one locally. Start from an isolated development checkout; do not reuse a server connected to live care records. Browser installation may download dependencies.

For infrastructure checks (from the repository root):

```bash
npm --prefix infra ci
npm --prefix infra test
npm --prefix infra run build
npm --prefix infra run synth
```

Synthesis produces infrastructure templates; it is not a deployment. Do not use deployment or production smoke scripts as ordinary local checks.

| Concern | Review entry point |
| --- | --- |
| Storage validation and import | [Storage tests](lib/__tests__/storage.test.ts), [import tests](lib/__tests__/import.test.ts) |
| Backup and shared-device ownership | [Backup tests](lib/__tests__/backup.test.ts), [cloud state tests](lib/__tests__/cloudState.test.ts) |
| Retrying cloud deletion | [Cloud deletion tests](lib/__tests__/cloudDeletes.test.ts) |
| Undo and failed saves | [Browser scenarios](e2e/undo-and-save-failure.spec.ts) |
| Export and restoration | [Browser backup scenarios](e2e/backup-restore.spec.ts) |
| Cloud resources and API behavior | [Infrastructure checks](infra/test/) |

[CI](.github/workflows/ci.yml) runs web lint/unit/build checks and infrastructure build/test/synth. Its Playwright job runs on PRs after the web job. These checks do not establish the state of a deployed environment.

## Engineering boundaries

| Decision | Implementation and limit |
| --- | --- |
| Local save first | [Storage](lib/storage.ts) reports save failure instead of presenting it as success; clearing browser data can still remove records |
| Optional backup | Cloud backup stores care logs; JSON export carries the broader app state |
| Restore by record ID | [Merge logic](lib/backup.ts) preserves existing local records when IDs overlap; this is not a general conflict-resolution engine |
| Undo across devices | [Pending cloud deletes](lib/cloudDeletes.ts) are retried during sync |
| Shared-device protection | [Cloud state](lib/cloudState.ts) checks account association before sending/restoring records; the browser itself is not a separately authenticated local vault |
| Support prompts | [Deterministic rules](lib/support.ts) show support information; they do not infer a diagnosis or predict risk |

## Deployment

The [production workflow](.github/workflows/deploy-prod.yml) uses **GitHub OIDC** to assume an AWS role, builds the static site, syncs the configured S3 prefix and invalidates CloudFront. It does not use long-lived AWS access keys. See [deployment details](docs/deploy.md) for configuration names and boundaries.

**Every push to `main`, including documentation-only changes, can trigger production deployment.** Manual dispatch also deploys, and a scheduled run checks for deployment drift every six hours. CI and deployment are separate workflows; do not assume deployment waits for all CI jobs simply because both exist.

Publish documentation on a branch for review. Merging to `main` and changing infrastructure are separate release decisions. A [synthetic availability workflow](.github/workflows/synthetic-check.yml) is also configured; its presence alone does not establish uptime.

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
docs/          Design principles, technical guides and operational documentation
```

---

## 日本語

使い方・保存範囲・開発手順は [日本語README](README.ja.md) を参照してください。

---

## License

MIT — see [LICENSE](LICENSE).

Part of the [VEAI LAB.](https://veai.jp) ecosystem — [Care Quest product page](https://veai.jp/apps/carequest/)
