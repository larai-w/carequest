# Cognito のトークンに acr / amr が加わる件の確認 (2026-10)

AWS のお知らせ: 2026-11-04 から Cognito のトークンに `acr`(文字列)と `amr`(文字列の配列)が加わり、
OIDC の設定(discovery)にも項目が加わる。決まった形しか受け付けないアプリは壊れることがある。

**結論: この repo には直す必要のある箇所は無い。** 「acr・amr が入っても通る」テストを足した。

## トークン・クレームを読んでいる場所

| 場所 | 何を読むか | 知らない項目への強さ |
| --- | --- | --- |
| `infra/lib/carequest-stack.ts` の `CognitoUserPoolsAuthorizer` | `Authorization` ヘッダーの ID トークン(署名・期限・発行元を API Gateway が検証) | API Gateway 側の処理。項目が増えても検証は変わらない |
| `infra/lambda/entries/index.js` | `requestContext.authorizer.claims` の `cognito:username`、無ければ `sub` だけ | 名前で1つ取るだけ。項目の数・順番・型を見ていない |
| `infra/lambda/feedback/`, `infra/lambda/feedback-digest/` | 認証なし。クレームは読まない | 対象外 |
| `lib/api.ts` | `fetchAuthSession()` の `tokens.idToken` の有無と `toString()`(そのまま Bearer で送る)、`getCurrentUser()` の `username` | 中身を自前で解析していない |
| `components/AuthPanel.tsx` | `getCurrentUser()` | 同上 |
| Amplify の `decodeJWT`(`@aws-amplify/core`) | トークンを `.` で3つに分けて `JSON.parse` するだけ | 項目の制限なし |

## 「知らない項目でエラーにする書き方」の有無

- スキーマの strict / `additionalProperties: false` / zod・ajv: **無し**。
  API Gateway の request model・validator も使っていない。
- 項目の数や順番の決め打ち: **無し**。Lambda は claims を名前で取るだけで、そのまま記録やログに混ぜていない
  (ログは method / resource / requestId のみ)。
- 入力のホワイトリスト(`validateEntry`)はリクエスト本文が対象で、クレームとは関係ない。
- OIDC の設定(discovery): 外部 IdP(OIDC)連携・Hosted UI・OAuth を使っておらず、discovery を読むコードも無い。

## 大きさの上限

- トークンの保存先は Amplify の既定(`localStorage`)。クッキーには入れていないので、クッキーの大きさの上限は当たらない。
- API は CloudFront を通さず、ブラウザから API Gateway(REST)を直接呼ぶ。REST API のヘッダー合計の上限
  (10,240 バイト)に対し、ID トークンはカスタム属性が無く小さい。`acr`・`amr` で増えるのは数十〜百バイト程度で、余裕がある。

## 気にしておくこと(直す必要はない)

- REST API の authorizer は claims を文字列の map にして Lambda に渡す。配列の `amr` がどんな文字列で届くかは
  決まっていないので、将来 `amr` を使う(例: MFA を通ったかで分ける)ときは、配列と文字列の両方の形を受け付けること。
  いまは使っていない。

## 足したテスト

- `infra/test/cognito-additive-claims.test.js`: claims に `acr`・`amr`(配列のまま/文字列にされた形)・知らない項目が
  入っても、`GET /entries` と `POST /entries` が本人の区画で動き、クレームが記録に混ざらないこと。
- `lib/__tests__/cognitoAdditiveClaims.test.ts`: `acr`・`amr` を含む ID トークンを Amplify が読めて、
  API には同じトークンが `Authorization: Bearer` でそのまま送られること。
