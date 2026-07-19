'use strict';

const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const dynamodb = new DynamoDBClient({});
const sns = new SNSClient({});

const MOOD_LABEL = {
  good: '😊 たすかっている',
  okay: '😌 ふつう',
  hard: '😢 つかいにくい',
};

// 直近7日の匿名フィードバックを集計して SNS(メール)へ送る週次ダイジェスト。
exports.handler = async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await dynamodb.send(
    new QueryCommand({
      TableName: process.env.FEEDBACK_TABLE_NAME,
      KeyConditionExpression: 'pk = :p AND sk >= :since',
      ExpressionAttributeValues: {
        ':p': { S: 'feedback' },
        ':since': { S: since },
      },
    })
  );

  const items = result.Items ?? [];
  const counts = { good: 0, okay: 0, hard: 0 };
  const notes = [];
  for (const it of items) {
    const mood = it.mood?.S;
    if (mood in counts) counts[mood] += 1;
    if (it.note?.S) {
      notes.push(`- [${MOOD_LABEL[mood] ?? mood}] ${it.note.S}`);
    }
  }

  const lines = [
    `CareQuest 週次フィードバック(直近7日: ${items.length}件)`,
    '',
    `😊 たすかっている: ${counts.good}`,
    `😌 ふつう: ${counts.okay}`,
    `😢 つかいにくい: ${counts.hard}`,
    '',
    notes.length > 0 ? `ひとこと(${notes.length}件):` : 'ひとことは今週はありませんでした。',
    ...notes,
    '',
    '手元で全件見る: ./scripts/read-feedback.sh',
  ];

  await sns.send(
    new PublishCommand({
      TopicArn: process.env.ALERT_TOPIC_ARN,
      Subject: `CareQuest 週次フィードバック(${items.length}件)`,
      Message: lines.join('\n'),
    })
  );

  return { count: items.length };
};
