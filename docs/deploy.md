# Care Quest production deployment

The app is served at **https://veai.jp/carequest/**. This document describes the checked-in [production workflow](../.github/workflows/deploy-prod.yml); it is not confirmation of live AWS configuration.

## Triggers and release boundary

- A push to `main` triggers deployment, including documentation-only changes.
- Manual `workflow_dispatch` also deploys.
- Every six hours, a scheduled run compares `main` with the stored `.deployed-sha` and deploys when they differ.

The [CI workflow](../.github/workflows/ci.yml) runs separately. The production workflow does not declare a dependency on completion of all CI jobs. Review the intended commit and required checks before authorizing a merge or deployment.

## Authentication and configuration

GitHub Actions uses OIDC with `id-token: write` to assume an AWS role in the `production` environment. The workflow does **not** use long-lived `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` values.

Repository/environment configuration names:

| Name | Purpose |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Role assumed through GitHub OIDC |
| `AWS_REGION` | Deployment region |
| `S3_BUCKET` | Bucket containing the `carequest/` prefix |
| `CLOUDFRONT_DISTRIBUTION_ID` | Distribution whose `/carequest/*` paths are invalidated |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Browser authentication configuration |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Browser authentication configuration |
| `NEXT_PUBLIC_API_URL` | Browser API endpoint |
| `NEXT_PUBLIC_AWS_REGION` | Browser AWS configuration |

The `NEXT_PUBLIC_` values are embedded at build time and visible to browser users even when supplied through GitHub secrets. They must not contain private credentials. Setting these names does not provision AWS resources; infrastructure source is in [`infra/`](../infra/).

## What the workflow does

1. Checks out the revision and assumes the OIDC role.
2. On scheduled runs, reads `carequest/.deployed-sha` from the configured bucket and skips deployment if it matches.
3. Installs dependencies and builds the Next.js static export with the public app configuration.
4. Writes the commit SHA into `out/.deployed-sha`.
5. Syncs static files to `s3://<configured-bucket>/carequest/`, and build assets to its `_next/` prefix, with different cache headers.
6. Invalidates `/carequest/*` in CloudFront.

The app uses `basePath: "/carequest"` and `trailingSlash: true`. Static hosting must preserve that URL layout.

## Permissions and shared hosting

The sync uses `--delete`. Scope the deployment role to the intended `carequest/` prefix and the intended CloudFront distribution; this prefix may share a bucket with other applications. Verify the OIDC trust policy, environment restrictions, bucket policy and CloudFront origin configuration in the target account before release. This document intentionally contains configuration names rather than deployment-specific account values.

Frontend publication and CDK deployment are separate operations. The production workflow described here does not deploy the CDK stack. Synthetic availability checks are defined in [their own workflow](../.github/workflows/synthetic-check.yml).
