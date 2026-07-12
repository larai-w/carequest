#!/bin/bash
set -euo pipefail

API_URL="${NEXT_PUBLIC_API_URL:-https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/}"
API_URL="${API_URL%/}"

echo "Backend health: ${API_URL}/health"
curl -fsS "${API_URL}/health"
echo

