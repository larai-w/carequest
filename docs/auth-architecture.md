# VEAI認証アーキテクチャ

**作成日:** 2026-08-02
**作成者:** Cline
**対象:** VEAIエコシステム全アプリ
**状態:** 設計確定（実装はCareQuestで先行）

---

## 1. 概要

VEAIエコシステムは**共通のCognito User Pool**を全アプリで共有する。
各アプリは独自のUser Pool Clientを作成し、認証フローを制御する。

```
┌─────────────────────────────────────────────────────────────┐
│                    VEAI認証基盤                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Cognito User Pool (共通)                     │   │
│  │         ID: ap-northeast-1_XXXXXXXXX                │   │
│  │         Export: VeaiSharedUserPoolId                │   │
│  │                                                     │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐         │   │
│  │  │ User A    │ │ User B    │ │ User C    │  ...    │   │
│  │  └───────────┘ └───────────┘ └───────────┘         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│           ┌──────────────┼──────────────┐                  │
│           ▼              ▼              ▼                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ CareQuest   │ │ ParkinSync  │ │ GutPacer    │  ...     │
│  │ Client      │ │ Client      │ │ Client      │          │
│  │ (SRP+PWD)   │ │ (SRP)       │ │ (SRP)       │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 設計原則

| # | 原則 | 理由 |
|---|------|------|
| 1 | **1ユーザー1アカウント** | VEAIエコシステム全体で共通のIDを使用 |
| 2 | **アプリ別Client** | アプリごとに認証フロー・スコープを制御 |
| 3 | **User PoolはCareQuestが所有** | 最初にデプロイされたアプリが「親」となる |
| 4 | **Cross-Stack参照** | CDK Export経由で他アプリから参照 |

---

## 3. CareQuest実装詳細

### 3.1 User Pool設定

```typescript
// infra/lib/carequest-stack.ts
const userPool = new cognito.UserPool(this, 'CareQuestUserPool', {
  selfSignUpEnabled: true,           // セルフサインアップ有効
  signInAliases: { email: true },    // メールでサインイン
  autoVerify: { email: true },       // メール自動検証
  standardAttributes: {
    givenName: { mutable: true, required: false },
    familyName: { mutable: true, required: false },
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },
  mfa: cognito.Mfa.OPTIONAL,         // MFA任意（2026-08-18有効化）
  mfaSecondFactor: {
    sms: false,                       // SMS無効（コスト・信頼性）
    otp: true,                        // TOTP有効（Google Authenticator等）
  },
  removalPolicy: cdk.RemovalPolicy.RETAIN,  // 誤削除防止
});
```

### 3.2 User Pool Client設定

```typescript
// infra/lib/carequest-stack.ts (L42-49)
const userPoolClient = new cognito.UserPoolClient(this, 'CareQuestUserPoolClient', {
  userPool,
  authFlows: {
    userPassword: true,  // 簡易認証（開発用）
    userSrp: true,       // SRP認証（推奨）
  },
  preventUserExistenceErrors: true,  // ユーザー存在エラーを隠蔽
});
```

### 3.3 Cross-Stack Export

```typescript
// infra/lib/carequest-stack.ts (L285-288)
new cdk.CfnOutput(this, 'UserPoolId', {
  value: userPool.userPoolId,
  exportName: 'VeaiSharedUserPoolId',  // ← 他アプリから参照
});
```

---

## 4. 他アプリからの参照方法

### 4.1 CDK (TypeScript)

```typescript
// 他アプリのスタック例
import * as cognito from 'aws-cdk-lib/aws-cognito';

// Cross-Stack参照でUser Poolを取得
const sharedUserPool = cognito.UserPool.fromUserPoolArn(
  this,
  'SharedUserPool',
  cdk.Fn.importValue('VeaiSharedUserPoolId')
);

// アプリ固有のClientを作成
const appClient = new cognito.UserPoolClient(this, 'ParkinSyncClient', {
  userPool: sharedUserPool,
  authFlows: {
    userSrp: true,
  },
  preventUserExistenceErrors: true,
});
```

### 4.2 SST (TypeScript)

```typescript
// sst.config.ts 例
const sharedUserPoolId = sst.aws.CfnParameter.get("SharedUserPoolId");

// Client作成
new sst.aws.CognitoUserPoolClient("ParkinSyncClient", {
  userPool: sharedUserPoolId,
  // ...
});
```

---

## 5. API認証フロー

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │ Cognito  │     │   API    │     │  Lambda  │
│  (Web)   │     │          │     │ Gateway  │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. SignIn      │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │ 2. ID Token    │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │ 3. API Call + Authorization: Bearer <token>      │
     │────────────────────────────────>│                │
     │                │                │                │
     │                │ 4. Token検証   │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │ 5. 検証OK      │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │ 6. Lambda呼び出し
     │                │                │───────────────>│
     │                │                │                │
     │                │                │ 7. レスポンス  │
     │                │                │<───────────────│
     │                │                │                │
     │ 8. Response    │                │                │
     │<────────────────────────────────│                │
     │                │                │                │
```

---

## 6. セキュリティ考慮事項

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| 1 | パスワードポリシー | ✅ | 8文字以上、大文字小文字数字必須 |
| 2 | メール検証 | ✅ | autoVerify有効 |
| 3 | SRP認証 | ✅ | userSrp: true |
| 4 | ユーザー存在隠蔽 | ✅ | preventUserExistenceErrors: true |
| 5 | Client Secret | ⚠️ | 未設定（SPA想定） |
| 6 | Token有効期限 | ⚠️ | デフォルト（1時間） |
| 7 | MFA | ✅ | OPTIONAL / TOTPのみ（2026-08-18有効化） |

---

## 7. 将来の拡張

### 7.1 MFA導入（完了: 2026-08-18）

MFAは `OPTIONAL` + TOTP のみで有効化済み。ユーザーは任意でTOTPアプリ（Google Authenticator, 1Password等）を登録できる。

```typescript
// 実装済み (carequest-stack.ts)
mfa: cognito.Mfa.OPTIONAL,
mfaSecondFactor: {
  sms: false,   // SMS無効（コスト・信頼性理由）
  otp: true,    // TOTP有効
},
```

**今後の検討:**
- パイロット施設ユーザー向けに `REQUIRED` への引き上げ
- WebAuthn (FIDO2) サポート追加

### 7.2 外部IdP連携

```typescript
// Google/Apple連携（将来）
const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
  userPool,
  clientId: 'xxx',
  clientSecret: 'yyy',
  scopes: ['profile', 'email'],
});
```

### 7.3 Alexa連携

Medication PromiseでAlexa連携が必要な場合：
- `cognito-alexa-linking.md` 参照
- Alexa Skills Kitとのアカウントリンク設定

---

## 8. 関連ドキュメント

| ドキュメント | 場所 |
|-------------|------|
| CareQuest CDK Stack | `infra/lib/carequest-stack.ts` |
| セキュリティ監査 | `veai-private/security/veai-ecosystem-security-audit_20260801.md` |
| ADR-0004 Secrets管理 | `veai-private/knowledge/adr/0004-secrets-management-approach.md` |
| Cognito-Alexa連携 | `veai-private/medication-promise/local-notes-from-clone/cognito-alexa-linking.md` |

---

## 9. 変更履歴

| 日付 | 変更内容 | 変更者 |
|------|---------|--------|
| 2026-08-02 | 初版作成 | Cline |
| 2026-08-18 | MFA有効化（OPTIONAL/TOTP） | Cline |

---

*このドキュメントはVEAIエコシステムの認証設計の単一情報源（Single Source of Truth）。*