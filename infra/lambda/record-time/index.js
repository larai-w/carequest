'use strict';

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const dynamodb = new DynamoDBClient({});

// ─── CORS(entries と同一ポリシー)──────────────────────────────────────────

const ALLOWED_ORIGINS = ['https://veai.jp', 'http://localhost:3000'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers['origin'] || event.headers['Origin'])) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ─── 構造化ログ(ボディ・ヘッダーは絶対に出力しない)────────────────────────

function log(event) {
  try {
    console.log(
      JSON.stringify({
        httpMethod: event.httpMethod,
        resource: event.resource,
        requestId: event.requestContext && event.requestContext.requestId,
      })
    );
  } catch {
    // ログ失敗は本処理に影響させない
  }
}

// ─── 入力検証 ─────────────────────────────────────────────────────────────
// BEN-004: 介護ケア記録プログラム「記録時間 < 10秒」の実測基盤。
// 1回の記録操作にかかった時間(ms)を受け取り、DynamoDBに保存する。
// ユーザー識別子は Cognito sub のみ。IP・User-Agent は保存しない。

const VALID_STEPS = ['quick', 'full', 'edit'];
const MAX_BODY_BYTES = 4 * 1024; // 4KB
const MAX_RECORD_TIME_MS = 10 * 60 * 1000; // 10分(異常値ガード)

class ValidationError extends Error {}

function validateRecordTime(rawBody) {
  if (typeof rawBody !== 'string' || rawBody.length === 0) {
    throw new ValidationError('body is required');
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    throw new ValidationError('body too large');
  }
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ValidationError('body must be JSON');
  }
  const durationMs = parsed.durationMs;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new ValidationError('durationMs must be a non-negative number');
  }
  if (durationMs > MAX_RECORD_TIME_MS) {
    throw new ValidationError('durationMs exceeds maximum');
  }
  const step = VALID_STEPS.includes(parsed.step) ? parsed.step : 'quick';
  return { durationMs: Math.round(durationMs), step };
}

// ─── ハンドラ ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  log(event);
  const headers = getCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'method not allowed' }) };
  }

  // Cognito認証済み前提。authorizer から sub(userId) を取得。
  const claims =
    event.requestContext &&
    event.requestContext.authorizer &&
    event.requestContext.authorizer.claims;
  const userId = claims && claims.sub;
  if (!userId) {
    return { statusCode: 401, headers, body: JSON.stringify({ message: 'unauthorized' }) };
  }

  let record;
  try {
    record = validateRecordTime(event.body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: error.message }) };
    }
    throw error;
  }

  const createdAt = new Date().toISOString();
  const item = {
    // ユーザー単位で集計しやすいよう pk=userId, sk=時系列
    pk: { S: `user#${userId}` },
    sk: { S: `${createdAt}#${crypto.randomUUID()}` },
    durationMs: { N: String(record.durationMs) },
    step: { S: record.step },
    createdAt: { S: createdAt },
  };

  try {
    await dynamodb.send(
      new PutItemCommand({
        TableName: process.env.RECORD_TIME_TABLE_NAME,
        Item: item,
      })
    );
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'internal error' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
