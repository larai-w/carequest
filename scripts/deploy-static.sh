#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-ap-northeast-1}"
S3_BUCKET="${S3_BUCKET:-veai-jp-toc-web}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E32Z6UIZTZD6DE}"

if [[ -z "${S3_BUCKET}" ]]; then
  echo "S3_BUCKET is required."
  exit 1
fi

if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID}" ]]; then
  echo "CLOUDFRONT_DISTRIBUTION_ID is required."
  exit 1
fi

npm run build

aws s3 sync out/ "s3://${S3_BUCKET}/carequest/" \
  --region "${REGION}" \
  --delete \
  --exclude "_next/*" \
  --cache-control "public,max-age=300"

aws s3 sync out/_next/ "s3://${S3_BUCKET}/carequest/_next/" \
  --region "${REGION}" \
  --delete \
  --cache-control "public,max-age=31536000,immutable"

aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "/carequest/*"
