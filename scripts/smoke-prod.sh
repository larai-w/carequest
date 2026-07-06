#!/bin/bash
set -euo pipefail

BASE_URL="${CAREQUEST_PROD_URL:-https://veai.jp/carequest}"

urls=(
  "${BASE_URL}/"
  "${BASE_URL}"
  "${BASE_URL}/quest/"
  "${BASE_URL}/community/"
  "${BASE_URL}/reflection/"
)

for url in "${urls[@]}"; do
  echo "Checking ${url}"
  curl -fsSI "${url}" | awk 'NR == 1 || tolower($0) ~ /^(content-type|cache-control|x-cache):/'
  echo
done

