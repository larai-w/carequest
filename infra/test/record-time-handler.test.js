'use strict';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddbMock = mockClient(DynamoDBClient);
let handler;

beforeEach(async () => {
  ddbMock.reset();
  ddbMock.on(PutItemCommand).resolves({});
  vi.resetModules();
  const mod = await import('../lambda/record-time/index.js');
  handler = mod.handler;
});

function event(body, overrides = {}) {
  return {
    httpMethod: 'POST',
    resource: '/record-time',
    headers: { origin: 'https://veai.jp' },
    requestContext: {
      requestId: 'test-req-id',
      authorizer: { claims: { sub: 'cognito-sub-123' } },
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...overrides,
  };
}

describe('POST /record-time', () => {
  it('認証済みの durationMs/step をユーザー単位で保存する', async () => {
    const res = await handler(event({ durationMs: 9876.4, step: 'full' }));
    expect(res.statusCode).toBe(200);
    const input = ddbMock.commandCalls(PutItemCommand)[0].args[0].input;
    expect(input.Item.pk).toEqual({ S: 'user#cognito-sub-123' });
    expect(input.Item.durationMs).toEqual({ N: '9876' });
    expect(input.Item.step).toEqual({ S: 'full' });
    expect(input.Item.recordTimeMs).toBeUndefined();
    expect(input.Item.screen).toBeUndefined();
  });

  it('未認証なら保存せず401を返す', async () => {
    const res = await handler(event({ durationMs: 1000 }, {
      requestContext: { requestId: 'unauthenticated' },
    }));
    expect(res.statusCode).toBe(401);
    expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
  });

  it('durationMs が不正なら400を返す', async () => {
    const res = await handler(event({ durationMs: 10 * 60 * 1000 + 1 }));
    expect(res.statusCode).toBe(400);
    expect(ddbMock.commandCalls(PutItemCommand)).toHaveLength(0);
  });

  it('未知のstepはquickに正規化する', async () => {
    const res = await handler(event({ durationMs: 1000, step: 'unknown' }));
    expect(res.statusCode).toBe(200);
    const input = ddbMock.commandCalls(PutItemCommand)[0].args[0].input;
    expect(input.Item.step).toEqual({ S: 'quick' });
  });

  it('OPTIONSは204を返す', async () => {
    const res = await handler(event(null, { httpMethod: 'OPTIONS', body: null }));
    expect(res.statusCode).toBe(204);
  });
});
