'use strict';

/**
 * Cognito のトークンに acr / amr が加わっても通ることを確かめる
 * (AWS のお知らせ: 2026-11-04 から。docs/cognito-additive-claims-2026-10.md)。
 *
 * REST API の Cognito authorizer は claims を文字列の平たい map にして渡す。
 * 配列の amr がどんな形で届くかは書かれていないため、配列のままの形と
 * 文字列にされた形の両方で試す。handler が読むのは cognito:username / sub だけ。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';

const ddbMock = mockClient(DynamoDBClient);

let handler;
beforeEach(async () => {
  ddbMock.reset();
  ddbMock.on(PutItemCommand).resolves({});
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  vi.stubEnv('TABLE_NAME', 'synthetic-entries');
  vi.resetModules();
  const mod = await import('../lambda/entries/index.js');
  handler = mod.handler;
});
afterEach(() => vi.unstubAllEnvs());

// いまの ID トークンに載っている項目(値は架空)
const baseClaims = {
  sub: 'sub-0001',
  'cognito:username': 'user-additive',
  email_verified: 'true',
  iss: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_EXAMPLE',
  aud: 'example-client-id',
  token_use: 'id',
  auth_time: '1793750400',
  exp: 'Wed Nov 04 01:00:00 UTC 2026',
  iat: 'Wed Nov 04 00:00:00 UTC 2026',
};

const variants = [
  ['いまの形(acr / amr なし)', baseClaims],
  ['acr と amr(配列のまま)', { ...baseClaims, acr: 'urn:example:acr', amr: ['pwd', 'mfa'] }],
  ['acr と amr(文字列にされた形)', { ...baseClaims, acr: 'urn:example:acr', amr: '[pwd, mfa]' }],
  ['acr と amr に加えて知らない項目', {
    ...baseClaims,
    acr: 'urn:example:acr',
    amr: ['pwd'],
    future_claim: 'x',
  }],
];

function event(method, claims, body = null) {
  return {
    httpMethod: method,
    resource: '/entries',
    headers: { origin: 'https://veai.jp' },
    requestContext: { requestId: 'r', authorizer: { claims } },
    body,
  };
}

describe('acr / amr が加わった claims', () => {
  for (const [name, claims] of variants) {
    it(`${name}: GET /entries は本人の pk で読む`, async () => {
      const res = await handler(event('GET', claims));
      expect(res.statusCode).toBe(200);
      const query = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
      expect(query.ExpressionAttributeValues[':userId']).toEqual({ S: 'user-additive' });
    });

    it(`${name}: POST /entries は本人の pk で保存し、claims を記録に混ぜない`, async () => {
      const res = await handler(
        event('POST', claims, JSON.stringify({ id: 'log-1', date: '2026-11-04' })),
      );
      expect(res.statusCode).toBe(201);
      const item = ddbMock.commandCalls(PutItemCommand)[0].args[0].input.Item;
      expect(item.pk).toEqual({ S: 'user-additive' });
      expect(item.acr).toBeUndefined();
      expect(item.amr).toBeUndefined();
    });
  }

  it('cognito:username が無くても sub で通る(acr / amr があっても順番は変わらない)', async () => {
    const withoutUsername = { ...baseClaims };
    delete withoutUsername['cognito:username'];
    const res = await handler(
      event('GET', { ...withoutUsername, acr: 'urn:example:acr', amr: ['pwd'] }),
    );
    expect(res.statusCode).toBe(200);
    const query = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(query.ExpressionAttributeValues[':userId']).toEqual({ S: 'sub-0001' });
  });
});
