#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI が見つかりません。インストールしてください。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm が見つかりません。"
  exit 1
fi

cd infra
npm install
npx cdk bootstrap
npx cdk deploy --require-approval never
