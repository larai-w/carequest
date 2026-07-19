'use strict';

/**
 * 匿名フィードバック Lambda のユニットテスト。
 * lambda-handler.test.js と同じ方式で DynamoDB をモックし、
 * infra/lambda/feedback/index.js の handler を直接呼び出す。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddbMock = mockClient(DynamoDBClient);

let handler;
beforeEach(async () => {
  ddbMock.reset();
  ddbMock.on(PutItemCommand).resolves({});
  vi.resetModules();
  const mod = await import('../lambda/feedback/index.js');
  handler = mod.handler;
});

function feedbackEvent(body, overrides = {}) {
  return {
    httpMethod: 'POST',
    resource: '/feedback',
    headers: { origin: 'https://veai.jp' },
    requestContext: { requestId: 'test-req-id' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...overrides,
  };
}

describe('POST /feedback', () => {
  it('mood のみで 200、テーブルに匿名で保存される', async () => {
    const res = await handler(feedbackEvent({ mood: 'good' }));
    expect(res.statusCode).toBe(200);
    const put = ddbMock.commandCalls(PutItemCommand)[0].args[0].input;
    expect(put.Item.pk.S).toBe('feedback');
    expect(put.Item.mood.S).toBe('good');
    expect(put.Item.note).toBeUndefined();
    // 匿名性: ユーザー識別子系のフィールドを保存しない
    expect(put.Item.userId).toBeUndefined();
  });

  it('note 付きで 200、trim されて保存される', async () => {
    const res = await handler(feedbackEvent({ mood: 'hard', note: '  文字が小さい  ' }));
    expect(res.statusCode).toBe(200);
    const put = ddbMock.commandCalls(PutItemCommand)[0].args[0].input;
    expect(put.Item.note.S).toBe('文字が小さい');
  });

  it('不正な mood は 400', async () => {
    const res = await handler(feedbackEvent({ mood: 'angry' }));
    expect(res.statusCode).toBe(400);
    expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
  });

  it('note が長すぎると 400', async () => {
    const res = await handler(feedbackEvent({ mood: 'good', note: 'あ'.repeat(501) }));
    expect(res.statusCode).toBe(400);
  });

  it('JSON でないボディは 400', async () => {
    const res = await handler(feedbackEvent('not-json'));
    expect(res.statusCode).toBe(400);
  });

  it('POST 以外は 405、OPTIONS は 204', async () => {
    const get = await handler(feedbackEvent({ mood: 'good' }, { httpMethod: 'GET' }));
    expect(get.statusCode).toBe(405);
    const options = await handler(feedbackEvent(null, { httpMethod: 'OPTIONS', body: null }));
    expect(options.statusCode).toBe(204);
  });

  it('DynamoDB 障害時は 500(例外を漏らさない)', async () => {
    ddbMock.on(PutItemCommand).rejects(new Error('boom'));
    const res = await handler(feedbackEvent({ mood: 'good' }));
    expect(res.statusCode).toBe(500);
  });

  it('CORS: 許可オリジンをそのまま返す', async () => {
    const res = await handler(feedbackEvent({ mood: 'good' }));
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://veai.jp');
  });
});
