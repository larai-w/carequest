#!/bin/sh
# 匿名フィードバックを新しい順に表示する。
# 使い方: ./scripts/read-feedback.sh [件数(既定20)]
# 必要権限: CareQuestStack の FeedbackTable への読み取り(AWS CLI 認証済み前提)
set -e
LIMIT="${1:-20}"
REGION="${AWS_REGION:-ap-northeast-1}"
TABLE=$(aws cloudformation describe-stacks --stack-name CareQuestStack --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FeedbackTableName'].OutputValue" --output text)
aws dynamodb query --table-name "$TABLE" --region "$REGION" \
  --key-condition-expression 'pk = :p' \
  --expression-attribute-values '{":p":{"S":"feedback"}}' \
  --no-scan-index-forward --max-items "$LIMIT" --output json |
python3 -c "
import json, sys
items = json.load(sys.stdin).get('Items', [])
mood_label = {'good': '😊 たすかっている', 'okay': '😌 ふつう', 'hard': '😢 つかいにくい'}
if not items:
    print('フィードバックはまだありません。')
for it in items:
    when = it['createdAt']['S'][:16].replace('T', ' ')
    mood = mood_label.get(it['mood']['S'], it['mood']['S'])
    note = it.get('note', {}).get('S', '')
    print(f'{when}  {mood}' + (f'\n    「{note}」' if note else ''))
"
