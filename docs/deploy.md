# Care Quest production deploy

Care Quest is published under:

```text
https://veai.jp/carequest/
```

The production deploy workflow is:

```text
development -> CI -> PR/merge to main -> S3 sync -> CloudFront invalidation
```

## GitHub Actions secrets

Add these in GitHub:

```text
Settings -> Secrets and variables -> Actions -> Repository secrets
```

Required secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-northeast-1
S3_BUCKET=veai-jp-toc-web
CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE
```

Required app config secrets:

```text
NEXT_PUBLIC_COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
```

## S3 layout

The workflow uploads the static export to:

```text
s3://veai-jp-toc-web/carequest/
```

CloudFront should serve it as:

```text
https://veai.jp/carequest/
```

## CloudFront checklist

Distribution:

```text
E32Z6UIZTZD6DE
```

Confirm:

- The existing default origin `veai-jp-toc-web` contains the `carequest/` prefix.
- `/carequest/*` falls through to the default behavior and is served from `veai-jp-toc-web`.
- The existing bucket policy allows CloudFront OAC to read objects from `veai-jp-toc-web`.
- CloudFront invalidation includes `/carequest/*`.

## Minimal IAM permissions for deploy key

Scope these permissions to the `veai-jp-toc-web` bucket and the `E32Z6UIZTZD6DE` distribution.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::veai-jp-toc-web"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::veai-jp-toc-web/carequest/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::*:distribution/E32Z6UIZTZD6DE"
    }
  ]
}
```
