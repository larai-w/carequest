#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_NAME="${STACK_NAME:-CareQuestStack}"
S3_BUCKET="${S3_BUCKET:-veai-jp-toc-web}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E32Z6UIZTZD6DE}"

echo "AWS identity"
aws sts get-caller-identity

echo
echo "CloudFormation stack: ${STACK_NAME}"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime,Outputs:Outputs}"

echo
echo "S3 bucket: ${S3_BUCKET}"
aws s3api head-bucket \
  --bucket "${S3_BUCKET}" \
  --region "${REGION}"

echo
echo "CloudFront distribution: ${CLOUDFRONT_DISTRIBUTION_ID}"
aws cloudfront get-distribution-config \
  --id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --query "DistributionConfig.{Aliases:Aliases.Items,Origins:Origins.Items[].{Id:Id,DomainName:DomainName},CacheBehaviors:CacheBehaviors.Items[].{PathPattern:PathPattern,TargetOriginId:TargetOriginId},DefaultOrigin:DefaultCacheBehavior.TargetOriginId}"
