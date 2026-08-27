'use strict';

/**
 * T28 – Lambda ユニットテスト
 * DynamoDB の send をモック (aws-sdk-client-mock) して infra/lambda/entries/index.js の
 * handler を直接呼び出す。AWSへの実際の通信は一切発生しない。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';

// ── DynamoDB モック ────────────────────────────────────────────────────────
const ddbMock = mockClient(DynamoDBClient);

// ── ハンドラを動的 import（モック設定後に読み込む）───────────────────────
// vitest は ESM/CJS 混在でも動的 import が使える
let handler;
beforeEach(async () => {
  ddbMock.reset();
  // デフォルトの正常レスポンス
  ddbMock.on(PutItemCommand).resolves({});
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(BatchWriteItemCommand).resolves({});

  // require をリセットするため vi.resetModules() を呼び、モジュールを再読込
  vi.resetModules();
  const mod = await import('../lambda/entries/index.js');
  handler = mod.handler;
});

// ── テストヘルパー ─────────────────────────────────────────────────────────
function makeEvent(overrides = {}) {
  return {
    httpMethod: 'GET',
    resource: '/health',
    headers: { origin: 'https://veai.jp' },
    requestContext: {
      requestId: 'test-req-id',
      authorizer: {
        claims: { 'cognito:username': 'user-123' },
      },
    },
    body: null,
    ...overrides,
  };
}

function postEvent(body, extra = {}) {
  return makeEvent({
    httpMethod: 'POST',
    resource: '/entries',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...extra,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OPTIONS プリフライト
// ─────────────────────────────────────────────────────────────────────────────
describe('OPTIONS プリフライト', () => {
  it('OPTIONS → 200 を返す', async () => {
    const res = await handler(makeEvent({ httpMethod: 'OPTIONS' }));
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /health (認証なし)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('200 と { status: "ok" } を返す', async () => {
    const res = await handler(makeEvent({ httpMethod: 'GET', resource: '/health' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 未知ルート → 404
// ─────────────────────────────────────────────────────────────────────────────
describe('未知ルート', () => {
  it('GET /unknown → 404', async () => {
    const res = await handler(makeEvent({ httpMethod: 'GET', resource: '/unknown' }));
    expect(res.statusCode).toBe(404);
  });

  it('PUT /entries → 404 (未対応メソッド)', async () => {
    const res = await handler(makeEvent({ httpMethod: 'PUT', resource: '/entries' }));
    expect(res.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /entries – 自分のクラウド記録を全削除 (US-503)
// ─────────────────────────────────────────────────────────────────────────────
function deleteEvent(username, extra = {}) {
  return makeEvent({
    httpMethod: 'DELETE',
    resource: '/entries',
    requestContext: {
      requestId: 'del-req',
      authorizer: { claims: { 'cognito:username': username } },
    },
    ...extra,
  });
}

describe('DELETE /entries (US-503)', () => {
  it('自分の pk のみを Query して削除する', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { pk: { S: 'alice' }, sk: { S: 'log-1' } },
        { pk: { S: 'alice' }, sk: { S: 'log-2' } },
      ],
    });
    const res = await handler(deleteEvent('alice'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, deleted: 2 });

    // Query は自分の pk のみを対象にする
    const queryInput = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(queryInput.ExpressionAttributeValues[':userId']).toEqual({ S: 'alice' });

    // BatchWriteItem に DeleteRequest が2件渡る
    const batchCalls = ddbMock.commandCalls(BatchWriteItemCommand);
    expect(batchCalls).toHaveLength(1);
    const requestItems = batchCalls[0].args[0].input.RequestItems;
    const tableRequests = Object.values(requestItems)[0];
    expect(tableRequests).toHaveLength(2);
    expect(tableRequests[0].DeleteRequest.Key).toEqual({ pk: { S: 'alice' }, sk: { S: 'log-1' } });
  });

  it('記録が無ければ deleted:0 で BatchWrite を呼ばない', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const res = await handler(deleteEvent('bob'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, deleted: 0 });
    expect(ddbMock.commandCalls(BatchWriteItemCommand)).toHaveLength(0);
  });

  it('ページネーション: LastEvaluatedKey を辿って全件削除する', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ pk: { S: 'c' }, sk: { S: 's1' } }], LastEvaluatedKey: { pk: { S: 'c' }, sk: { S: 's1' } } })
      .resolvesOnce({ Items: [{ pk: { S: 'c' }, sk: { S: 's2' } }] });
    const res = await handler(deleteEvent('c'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, deleted: 2 });
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  it('26件は25件+1件の2バッチに分けて削除する', async () => {
    const items = Array.from({ length: 26 }, (_, i) => ({ pk: { S: 'd' }, sk: { S: `s${i}` } }));
    ddbMock.on(QueryCommand).resolves({ Items: items });
    const res = await handler(deleteEvent('d'));
    expect(JSON.parse(res.body)).toEqual({ ok: true, deleted: 26 });
    expect(ddbMock.commandCalls(BatchWriteItemCommand)).toHaveLength(2);
  });

  it('DynamoDB エラー時 → 500', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('DDB Error'));
    const res = await handler(deleteEvent('e'));
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /entries – 自分の pk のみ Query される
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /entries', () => {
  it('Cognito userId を pk として Query する', async () => {
    const res = await handler(
      makeEvent({
        httpMethod: 'GET',
        resource: '/entries',
        requestContext: {
          requestId: 'r1',
          authorizer: { claims: { 'cognito:username': 'alice' } },
        },
      })
    );
    expect(res.statusCode).toBe(200);

    // QueryCommand に渡された引数を検証
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0].args[0].input;
    expect(input.ExpressionAttributeValues[':userId']).toEqual({ S: 'alice' });
  });

  it('DynamoDB エラー時 → 500 (400 と混同しない)', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('DDB Error'));
    const res = await handler(makeEvent({ httpMethod: 'GET', resource: '/entries' }));
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /entries – 正常系
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /entries – 正常系', () => {
  it('正常 POST → 201', async () => {
    const res = await handler(postEvent({ id: 'entry-001', date: '2024-01-15' }));
    expect(res.statusCode).toBe(201);
  });

  it('sk が id と一致する (冪等 PUT)', async () => {
    await handler(postEvent({ id: 'idem-42', date: '2024-01-15' }));
    const calls = ddbMock.commandCalls(PutItemCommand);
    // 2件: 記録本体 + presence マーカー(T54)。記録本体は先(calls[0])。
    expect(calls).toHaveLength(2);
    const item = calls[0].args[0].input.Item;
    // sk = id
    expect(item.sk).toEqual({ S: 'idem-42' });
    // pk = userId (サーバー側)
    expect(item.pk).toEqual({ S: 'user-123' });
  });

  it('レスポンスに item が含まれる', async () => {
    const res = await handler(postEvent({ id: 'e1', date: '2024-02-01', points: 10 }));
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.item.id).toBe('e1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /entries – クロステナント書き込み防止
// ─────────────────────────────────────────────────────────────────────────────
describe('クロステナント書き込み防止 (T27 回帰テスト)', () => {
  it('ボディに pk を入れてもサーバー側の userId で上書きされる', async () => {
    await handler(
      postEvent(
        { id: 'x1', pk: 'evil-user', date: '2024-01-01' },
        {
          requestContext: {
            requestId: 'r',
            authorizer: { claims: { 'cognito:username': 'real-user' } },
          },
        }
      )
    );
    const calls = ddbMock.commandCalls(PutItemCommand);
    // 2件: 記録本体 + presence マーカー(T54)
    expect(calls).toHaveLength(2);
    const item = calls[0].args[0].input.Item;
    expect(item.pk).toEqual({ S: 'real-user' }); // ボディの 'evil-user' は無視される
  });

  it('ボディに sk を入れてもサーバー側の id で上書きされる', async () => {
    await handler(postEvent({ id: 'safe-id', sk: 'evil-sk', date: '2024-01-01' }));
    const calls = ddbMock.commandCalls(PutItemCommand);
    const item = calls[0].args[0].input.Item;
    expect(item.sk).toEqual({ S: 'safe-id' }); // sk は id ベース
  });

  it('ボディに userId を入れてもサーバー側の userId で上書きされる', async () => {
    await handler(
      postEvent(
        { id: 'y1', userId: 'attacker', date: '2024-01-01' },
        {
          requestContext: {
            requestId: 'r',
            authorizer: { claims: { sub: 'cognito-sub-abc' } },
          },
        }
      )
    );
    const calls = ddbMock.commandCalls(PutItemCommand);
    const item = calls[0].args[0].input.Item;
    expect(item.userId).toEqual({ S: 'cognito-sub-abc' }); // ボディの 'attacker' は無視
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// presence – 今日のともしび (T54)
// ─────────────────────────────────────────────────────────────────────────────
describe('presence – 今日のともしび (T54)', () => {
  it('POST 成功時に presence マーカーを書く (pk=presence#JST日付, sk=64桁hex)', async () => {
    await handler(postEvent({ id: 'pm-1', date: '2024-01-15' }));
    const calls = ddbMock.commandCalls(PutItemCommand);
    expect(calls).toHaveLength(2);
    const marker = calls[1].args[0].input.Item;
    expect(marker.pk.S).toMatch(/^presence#\d{4}-\d{2}-\d{2}$/);
    expect(marker.sk.S).toMatch(/^[0-9a-f]{64}$/);
  });

  it('同じユーザーの同日2回目も同じ sk (冪等 = distinct カウントの元)', async () => {
    await handler(postEvent({ id: 'pm-a', date: '2024-01-15' }));
    await handler(postEvent({ id: 'pm-b', date: '2024-01-15' }));
    const calls = ddbMock.commandCalls(PutItemCommand);
    // [entry, marker, entry, marker]
    expect(calls).toHaveLength(4);
    expect(calls[1].args[0].input.Item.sk.S).toBe(calls[3].args[0].input.Item.sk.S);
  });

  it('presence 書き込みが失敗しても 201 (best-effort)', async () => {
    ddbMock
      .on(PutItemCommand)
      .resolvesOnce({}) // 記録本体は成功
      .rejectsOnce(new Error('presence write failed')); // マーカーは失敗
    const res = await handler(postEvent({ id: 'pm-fail', date: '2024-01-15' }));
    expect(res.statusCode).toBe(201);
  });

  it('GET /presence は Query の Count を count として返す (認証 claims なしで動く)', async () => {
    ddbMock.on(QueryCommand).resolves({ Count: 7 });
    const res = await handler(
      makeEvent({
        httpMethod: 'GET',
        resource: '/presence',
        // 認証なしルート: authorizer を持たない requestContext
        requestContext: { requestId: 'presence-req' },
      })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(7);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Query は presence# プレフィックスの pk を対象にする
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.ExpressionAttributeValues[':pk'].S).toMatch(/^presence#/);
    expect(input.Select).toBe('COUNT');
  });

  it('GET /presence で DynamoDB エラー時 → 500', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('DDB Error'));
    const res = await handler(
      makeEvent({ httpMethod: 'GET', resource: '/presence', requestContext: { requestId: 'r' } })
    );
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /entries – バリデーション 400 系
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /entries – バリデーション 400', () => {
  it('id 欠落 → 400', async () => {
    const res = await handler(postEvent({ date: '2024-01-01' }));
    expect(res.statusCode).toBe(400);
  });

  it('points が文字列 → 400', async () => {
    const res = await handler(postEvent({ id: 'p1', points: '10' }));
    expect(res.statusCode).toBe(400);
  });

  it('points が Infinity → 400', async () => {
    // JSON では Infinity は直接書けないため、JSON 化された "null" 等の代わりに
    // String を使う実装上のテスト。実際には validateEntry が typeof===number かつ
    // isFinite を要求するので、文字列でも非有限数でも 400。
    const res = await handler(postEvent({ id: 'p2', points: 'Infinity' }));
    expect(res.statusCode).toBe(400);
  });

  it('date 形式不正 → 400', async () => {
    const res = await handler(postEvent({ id: 'd1', date: '01-15-2024' }));
    expect(res.statusCode).toBe(400);
  });

  it('energyLevel が enum 外 → 400', async () => {
    const res = await handler(postEvent({ id: 'e1', energyLevel: 'supercharged' }));
    expect(res.statusCode).toBe(400);
  });

  it('energyLevel が low → 201 (正常 enum)', async () => {
    const res = await handler(postEvent({ id: 'e2', energyLevel: 'low' }));
    expect(res.statusCode).toBe(201);
  });

  it('energyLevel が normal → 201', async () => {
    const res = await handler(postEvent({ id: 'e3', energyLevel: 'normal' }));
    expect(res.statusCode).toBe(201);
  });

  it('energyLevel が energetic → 201', async () => {
    const res = await handler(postEvent({ id: 'e4', energyLevel: 'energetic' }));
    expect(res.statusCode).toBe(201);
  });

  it('壊れた JSON → 400', async () => {
    const res = await handler(
      makeEvent({ httpMethod: 'POST', resource: '/entries', body: '{invalid json' })
    );
    expect(res.statusCode).toBe(400);
  });

  it('body が null → 400', async () => {
    const res = await handler(
      makeEvent({ httpMethod: 'POST', resource: '/entries', body: null })
    );
    expect(res.statusCode).toBe(400);
  });

  it('ボディ 10KB 超 → 400', async () => {
    const bigBody = JSON.stringify({ id: 'big', title: 'x'.repeat(10 * 1024 + 1) });
    const res = await handler(
      makeEvent({ httpMethod: 'POST', resource: '/entries', body: bigBody })
    );
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /entries – DynamoDB エラー時 → 500
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /entries – DynamoDB エラー → 500', () => {
  it('PutItem が失敗したとき 500 を返す (400 と混同しない)', async () => {
    ddbMock.on(PutItemCommand).rejects(new Error('provisioned throughput exceeded'));
    const res = await handler(postEvent({ id: 'ok-input', date: '2024-01-01' }));
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CORS – 許可外オリジン
// ─────────────────────────────────────────────────────────────────────────────
describe('CORS ヘッダー', () => {
  it('許可オリジン (https://veai.jp) → そのまま返す', async () => {
    const res = await handler(
      makeEvent({ httpMethod: 'GET', resource: '/health', headers: { origin: 'https://veai.jp' } })
    );
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://veai.jp');
  });

  it('localhost:3000 → そのまま返す', async () => {
    const res = await handler(
      makeEvent({ httpMethod: 'GET', resource: '/health', headers: { origin: 'http://localhost:3000' } })
    );
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('許可外オリジン → Access-Control-Allow-Origin がデフォルト (https://veai.jp) になる', async () => {
    const res = await handler(
      makeEvent({
        httpMethod: 'GET',
        resource: '/health',
        headers: { origin: 'https://evil.example.com' },
      })
    );
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://veai.jp');
  });

  it('Origin ヘッダーなし → デフォルト (https://veai.jp)', async () => {
    const res = await handler(
      makeEvent({ httpMethod: 'GET', resource: '/health', headers: {} })
    );
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://veai.jp');
  });
});

// ── 身元が無いときは触らない（2026-08-27）────────────────────────────────
//
// 以前は `|| 'anonymous'` で固定文字列へ落ちていた。
// /entries は Cognito 必須なので当時は到達しなかったが、
// **認可を外したり、この handler を公開経路で使い回すと、
// 全員が同じ区画（anonymous）に入る。** 読みも書きも混ざる。
//
// 2026-08-27 に GutPacer で実際にそれが起きた（同意記録が世帯で
// 分かれておらず、他所帯の同意で通る状態だった）。
// **誰の記録か決められないなら、触らない。**

describe('身元が無いリクエスト', () => {
  const cases = [
    ['authorizer ごと無い', { requestContext: { requestId: 'r' } }],
    ['claims が無い', { requestContext: { requestId: 'r', authorizer: {} } }],
    ['claims が空', { requestContext: { requestId: 'r', authorizer: { claims: {} } } }],
  ];

  for (const [name, ctx] of cases) {
    it(`${name} → 401 で、DynamoDB に触らない`, async () => {
      const res = await handler({
        httpMethod: 'GET',
        resource: '/entries',
        headers: { origin: 'https://veai.jp' },
        body: null,
        ...ctx,
      });
      expect(res.statusCode).toBe(401);
      // **読みにも行かない。** anonymous 区画を作らない。
      expect(ddbMock.commandCalls(QueryCommand).length).toBe(0);
    });
  }

  it('書き込みも 401 で、何も保存しない', async () => {
    const res = await handler({
      httpMethod: 'POST',
      resource: '/entries',
      headers: { origin: 'https://veai.jp' },
      body: JSON.stringify({ date: '2026-08-27', energyLevel: 3 }),
      requestContext: { requestId: 'r', authorizer: { claims: {} } },
    });
    expect(res.statusCode).toBe(401);
    expect(ddbMock.commandCalls(PutItemCommand).length).toBe(0);
  });

  it('固定文字列の区画をコードが持たない', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../lambda/entries/index.js', import.meta.url),
      'utf8',
    );
    // コメント行を除いて `'anonymous'` が残っていないこと
    const code = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toContain("'anonymous'");
  });

  it('公開の /presence は身元が無くても動く（巻き込まない）', async () => {
    // 認証を厳しくした結果、公開経路まで止めてしまわないこと。
    ddbMock.on(QueryCommand).resolves({ Count: 3 });
    const res = await handler({
      httpMethod: 'GET',
      resource: '/presence',
      headers: { origin: 'https://veai.jp' },
      body: null,
      requestContext: { requestId: 'r' },
    });
    expect(res.statusCode).toBe(200);
  });
});
