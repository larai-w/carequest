'use strict';

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

// ご意見の保存期間(1年)。変えるときは app/privacy と app/delete-account の文言も直す。
const FEEDBACK_RETENTION_SECONDS = 365 * 24 * 60 * 60;

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
    'Access-Control-Allow-Headers': 'Content-Type',
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

// 匿名フィードバック。受け取るのは mood(3値)と任意の note のみ。
// ユーザー識別子・IP・User-Agent は保存しない(匿名性の担保)。
const VALID_MOODS = ['good', 'okay', 'hard'];
const MAX_NOTE_LENGTH = 500;
const MAX_BODY_BYTES = 4 * 1024; // 4KB

class ValidationError extends Error {}

function validateFeedback(rawBody) {
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
  if (!VALID_MOODS.includes(parsed.mood)) {
    throw new ValidationError('mood must be one of good/okay/hard');
  }
  const feedback = { mood: parsed.mood };
  if (parsed.note !== undefined && parsed.note !== null && parsed.note !== '') {
    if (typeof parsed.note !== 'string') {
      throw new ValidationError('note must be a string');
    }
    const note = parsed.note.trim();
    if (note.length > MAX_NOTE_LENGTH) {
      throw new ValidationError('note exceeds maximum length');
    }
    if (note.length > 0) {
      feedback.note = note;
    }
  }
  return feedback;
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

  let feedback;
  try {
    feedback = validateFeedback(event.body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: error.message }) };
    }
    throw error;
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const item = {
    pk: { S: 'feedback' },
    sk: { S: `${createdAt}#${crypto.randomUUID()}` },
    mood: { S: feedback.mood },
    createdAt: { S: createdAt },
    // 1年で自動で消す(DynamoDB の TTL・秒)。ご意見は誰のものか分からない形で保存するので、
    // 個別には消せない。そのかわり保存期間を決めて、プライバシーの説明と一致させる(2026-10-03)。
    expiresAt: { N: String(Math.floor(now.getTime() / 1000) + FEEDBACK_RETENTION_SECONDS) },
  };
  if (feedback.note) {
    item.note = { S: feedback.note };
  }

  try {
    await dynamodb.send(
      new PutItemCommand({
        TableName: process.env.FEEDBACK_TABLE_NAME,
        Item: item,
      })
    );
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'internal error' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};

