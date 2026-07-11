"use client";

import type { ResourcesConfig } from "aws-amplify";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

// configure が一度でも走ったかを覚えておくフラグ。
// 同じモジュールが複数回呼ばれても Amplify.configure は一度で済ませる。
let configured = false;

/**
 * Amplify を「認証機能を実際に使う瞬間」にだけ初期化する。
 *
 * aws-amplify 本体(数百KB)は静的 import しない。この関数を await した
 * ときに初めて動的 import され、認証を使わない大多数のユーザーの初期
 * バンドルからは完全に外れる(T45)。
 *
 * Cognito 未設定(環境変数なし)の場合は import すらせず即座に返る。
 */
export async function ensureAmplifyConfigured(): Promise<void> {
  if (configured) {
    return;
  }
  if (!userPoolId || !userPoolClientId) {
    // 設定がなければ configure しない。認証系はすべて安全側(未サインイン)に倒れる。
    return;
  }

  const { Amplify } = await import("aws-amplify");
  const amplifyConfig: ResourcesConfig = {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          username: true,
        },
      },
    },
  };

  Amplify.configure(amplifyConfig);
  configured = true;
}
