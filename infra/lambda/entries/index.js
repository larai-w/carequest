'use strict';

const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
} = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const dynamodb = new DynamoDBClient({});

// ─── DynamoDB マーシャリング ────────────────────────────────────────────────

function toAttributeValue(value) {
  if (value === null || value === undefined) {
    return { NULL: true };
  }
  if (Array.isArray(value)) {
    return { L: value.map(toAttributeValue) };
  }
  if (typeof value === 'object') {
    return {
      M: Object.fromEntries(
        Object.entries(value).map(([key, childValue]) => [key, toAttributeValue(childValue)])
      ),
    };
  }
  if (typeof value === 'number') {
    return { N: String(value) };
  }
  if (typeof value === 'boolean') {
    return { BOOL: value };
  }
  return { S: String(value) };
}

function fromAttributeValue(attributeValue) {
  if ('S' in attributeValue) return attributeValue.S;
  if ('N' in attributeValue) return Number(attributeValue.N);
  if ('BOOL' in attributeValue) return attributeValue.BOOL;
  if ('NULL' in attributeValue) return null;
  if ('L' in attributeValue) return attributeValue.L.map(fromAttributeValue);
  if ('M' in attributeValue) {
    return Object.fromEntries(
      Object.entries(attributeValue.M).map(([key, childValue]) => [key, fromAttributeValue(childValue)])
    );
  }
  return undefined;
}

function toItem(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, toAttributeValue(value)])
  );
}

function fromItem(item) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, fromAttributeValue(value)])
  );
}

// ─── 今日のともしび(presence・T54 / US-401 の最小形)──────────────────────
// その日に記録を同期した distinct ユーザー数を匿名で数えるためのマーカー。
// sk は userId の不可逆ハッシュ(PII を保存しない。アカウント削除で掃除不要)。

// JST 基準の日付(YYYY-MM-DD)。Lambda は UTC で動くため +9h してから切り出す。
function getJstDate(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function presencePk(date) {
  return `presence#${date}`;
}

function presenceSk(userId, date) {
  return crypto.createHash('sha256').update(`${userId}#${date}`).digest('hex');
}

// ─── CORS ────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = ['https://veai.jp', 'http://localhost:3000'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers['origin'] || event.headers['Origin'])) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ─── 構造化ログ(トークン・ヘッダー・ボディは絶対に出力しない)─────────────

function log(event) {
  // 必要最小限のフィールドのみ。event 全体・headers・body は含めない。
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

// クライアントから受け取ってよいフィールドは validateEntry 内で明示的に検証・
// コピーする(ホワイトリスト方式)。id, taskId, title, points, completedAt,
// date, energyLevel のみ。pk / sk / userId はサーバー側で必ず設定し、
// ボディからは決して受け取らない。
const MAX_BODY_BYTES = 10 * 1024; // 10KB
const MAX_TITLE_LENGTH = 200;
const MAX_STRING_LENGTH = 1024; // id/taskId/completedAt/energyLevel 等の一般文字列上限
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${field} exceeds maximum length`);
  }
  return value;
}

// 生ボディ文字列を検証してホワイトリスト済みの安全なフィールド集合を返す。
function validateEntry(rawBody) {
  if (typeof rawBody !== 'string') {
    throw new ValidationError('body is required');
  }
  // サイズ上限(バイト数)
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    throw new ValidationError('body exceeds maximum size');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ValidationError('body must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('body must be a JSON object');
  }

  const clean = {};

  // id は必須(sk のベース。冪等な PUT のため)
  if (parsed.id === undefined || parsed.id === null) {
    throw new ValidationError('id is required');
  }
  const id = requireString(parsed.id, 'id', MAX_STRING_LENGTH);
  if (id.length === 0) {
    throw new ValidationError('id must not be empty');
  }
  clean.id = id;

  if (parsed.taskId !== undefined) {
    clean.taskId = requireString(parsed.taskId, 'taskId', MAX_STRING_LENGTH);
  }
  if (parsed.title !== undefined) {
    clean.title = requireString(parsed.title, 'title', MAX_TITLE_LENGTH);
  }
  if (parsed.points !== undefined) {
    if (typeof parsed.points !== 'number' || !Number.isFinite(parsed.points)) {
      throw new ValidationError('points must be a finite number');
    }
    clean.points = parsed.points;
  }
  if (parsed.completedAt !== undefined) {
    clean.completedAt = requireString(parsed.completedAt, 'completedAt', MAX_STRING_LENGTH);
  }
  if (parsed.date !== undefined) {
    const date = requireString(parsed.date, 'date', MAX_STRING_LENGTH);
    if (!DATE_RE.test(date)) {
      throw new ValidationError('date must be YYYY-MM-DD');
    }
    clean.date = date;
  }
  if (parsed.energyLevel !== undefined) {
    // フロントの EnergyLevel 型(lib/types.ts)と同じ enum のみ許容する。
    if (!['low', 'normal', 'energetic'].includes(parsed.energyLevel)) {
      throw new ValidationError('energyLevel must be one of low, normal, energetic');
    }
    clean.energyLevel = parsed.energyLevel;
  }

  return clean;
}

// ─── レスポンスヘルパー ─────────────────────────────────────────────────────

function response(statusCode, corsHeaders, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

// ─── ハンドラ ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  log(event);
  const corsHeaders = getCorsHeaders(event);

  // CORS プリフライト
  if (event.httpMethod === 'OPTIONS') {
    return response(200, corsHeaders, '');
  }

  // /health は認証なし
  if (event.httpMethod === 'GET' && event.resource === '/health') {
    return response(200, corsHeaders, { status: 'ok' });
  }

  // GET /presence は認証なし: 今日(JST)に記録を同期した人数の匿名集計(T54)。
  // 個人を特定できる情報は返さない(distinct ユーザー数のみ)。
  if (event.httpMethod === 'GET' && event.resource === '/presence') {
    try {
      const date = getJstDate();
      const result = await dynamodb.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': { S: presencePk(date) } },
          Select: 'COUNT',
        })
      );
      return response(200, corsHeaders, { date, count: result.Count || 0 });
    } catch (error) {
      console.error('Presence error:', error.message);
      return response(500, corsHeaders, { message: 'Error fetching presence' });
    }
  }

  // Cognito authorizer から userId を抽出(サーバー側でのみ決定する)
  //
  // ⚠️ **クレームが無いときに固定文字列へ落とさない。**
  //
  // 以前は `|| 'anonymous'` だった。/entries は Cognito 必須なので当時は
  // 到達しなかったが、**認可を外したり、この handler を公開経路で使い回すと、
  // 全員が同じ区画（anonymous）に入る。** 読みも書きも混ざる。
  //
  // 2026-08-27 に GutPacer で実際にそれが起きた（同意記録が世帯で分かれておらず、
  // 他所帯の同意で通る状態だった）。エコシステムの他製品は例外で止めている:
  //   CareReady          → raise _Unauthorized("missing identity claims")
  //   Medication Promise → throw new ConsentSubjectError()
  // ここも揃える。**誰の記録か決められないなら、触らない。**
  const authorizer = event.requestContext && event.requestContext.authorizer;
  const claims = authorizer && authorizer.claims;
  const userId = claims && (claims['cognito:username'] || claims.sub);

  if (!userId) {
    console.error('AUTH_MISSING_CLAIMS resource=%s method=%s', event.resource, event.httpMethod);
    return response(401, corsHeaders, { message: 'Unauthorized' });
  }

  if (event.httpMethod === 'GET' && event.resource === '/entries') {
    try {
      const result = await dynamodb.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: 'pk = :userId',
          ExpressionAttributeValues: { ':userId': { S: userId } },
        })
      );
      return response(200, corsHeaders, (result.Items || []).map(fromItem));
    } catch (error) {
      console.error('Query error:', error.message);
      return response(500, corsHeaders, { message: 'Error fetching entries' });
    }
  }

  if (event.httpMethod === 'POST' && event.resource === '/entries') {
    let clean;
    try {
      clean = validateEntry(event.body);
    } catch (error) {
      // 入力不正は 400(500 にしない)
      return response(400, corsHeaders, { message: error.message || 'Invalid request' });
    }

    // pk / sk / userId はサーバー側で必ず設定。ボディの値は無視される。
    const item = {
      ...clean,
      pk: userId,
      sk: clean.id, // sk は id ベース。同一記録の再送は同じ sk で冪等な PUT になる。
      userId: userId,
    };

    try {
      await dynamodb.send(
        new PutItemCommand({ TableName: process.env.TABLE_NAME, Item: toItem(item) })
      );

      // 今日のともしび(T54): その日に記録した人の匿名マーカーを best-effort で残す。
      // 同一ユーザー・同一日は同じ sk になる冪等 PUT(distinct カウントの元)。
      // 失敗しても記録保存は成功のまま(catch して握る)。
      try {
        const date = getJstDate();
        await dynamodb.send(
          new PutItemCommand({
            TableName: process.env.TABLE_NAME,
            Item: { pk: { S: presencePk(date) }, sk: { S: presenceSk(userId, date) } },
          })
        );
      } catch (presenceError) {
        console.error('Presence marker error:', presenceError.message);
      }

      return response(201, corsHeaders, { ok: true, item });
    } catch (error) {
      console.error('Put error:', error.message);
      return response(500, corsHeaders, { message: 'Error saving entry' });
    }
  }

  // DELETE /entries: 認証ユーザー自身(pk = userId)の記録をすべて削除する(US-503)。
  // 端末側(localStorage)の記録には一切触れない。サーバーのバックアップのみを消す。
  // pk はトークン由来の userId で固定。他ユーザーのパーティションは触れない。
  if (event.httpMethod === 'DELETE' && event.resource === '/entries') {
    try {
      let deleted = 0;
      let lastEvaluatedKey;
      do {
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: 'pk = :userId',
            ExpressionAttributeValues: { ':userId': { S: userId } },
            // 削除にはキー(pk, sk)だけあればよい。本文は取得しない。
            ProjectionExpression: 'pk, sk',
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );
        const items = result.Items || [];
        // BatchWriteItem は1回25件まで。25件ずつ削除する。
        for (let i = 0; i < items.length; i += 25) {
          const batch = items.slice(i, i + 25);
          await dynamodb.send(
            new BatchWriteItemCommand({
              RequestItems: {
                [process.env.TABLE_NAME]: batch.map((it) => ({
                  DeleteRequest: { Key: { pk: it.pk, sk: it.sk } },
                })),
              },
            })
          );
          deleted += batch.length;
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return response(200, corsHeaders, { ok: true, deleted });
    } catch (error) {
      console.error('Delete error:', error.message);
      return response(500, corsHeaders, { message: 'Error deleting entries' });
    }
  }

  return response(404, corsHeaders, { message: 'Not found' });
};
