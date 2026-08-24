/**
 * T28 – CDK assertions テスト
 * aws-cdk-lib/assertions の Template を使って fine-grained アサーションを行う。
 * スナップショットテストは使わず、各プロパティを個別に検証する。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Annotations, Template, Match } from 'aws-cdk-lib/assertions';
import { CareQuestStack } from '../lib/carequest-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new CareQuestStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  template = Template.fromStack(stack);
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cognito UserPool – DeletionPolicy が Retain
// ─────────────────────────────────────────────────────────────────────────────
describe('Cognito UserPool', () => {
  it('DeletionPolicy が Retain', () => {
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
    });
  });

  it('MFA は OPTIONAL で TOTP のみ有効', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
  });

  // 本番は DeletionProtection=INACTIVE だった(2026-08-24 実測)。
  // User Pool が消えると全アカウントが失われる。
  it('削除保護が有効', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      DeletionProtection: 'ACTIVE',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DynamoDB Table – DeletionPolicy が Retain
// ─────────────────────────────────────────────────────────────────────────────
describe('DynamoDB Table', () => {
  it('DeletionPolicy が Retain', () => {
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DynamoDB – PITR 有効
  // ─────────────────────────────────────────────────────────────────────────
  it('PITR (Point-in-Time Recovery) が有効', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  // hasResourceProperties は「どれか1つ」で通る。feedbackTable は本番で
  // PITR が有効なのにコードに無く、次の deploy で無効へ戻りうる状態
  // だった(2026-08-24 の実測)。全テーブルを個別に見る。
  it('すべてのテーブルで PITR と削除保護が有効', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    const ids = Object.keys(tables);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const props = tables[id].Properties ?? {};
      expect(props.PointInTimeRecoverySpecification).toEqual({
        PointInTimeRecoveryEnabled: true,
      });
      expect(props.DeletionProtectionEnabled).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.5 アラート購読 — alertEmail を渡し忘れると監視が消える
//
// 購読は alertEmail がある時だけ作られる。付けずにデプロイすると
// **既にある購読が差分として削除される**（2026-08-24 の cdk diff で実測）。
// アラーム自体は残るので、コンソールを見ない限り誰も気づけない。
// 手順書は消えても、この2件が消えれば気づけるようにしておく。
// ─────────────────────────────────────────────────────────────────────────────
describe('アラートメール購読', () => {
  it('alertEmail を渡せば SNS のメール購読が作られる', () => {
    const app = new cdk.App({ context: { alertEmail: 'ops@example.com' } });
    const stack = new CareQuestStack(app, 'WithEmailStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    Template.fromStack(stack).hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'ops@example.com',
    });
  });

  it('alertEmail が無いと購読が作られず、警告が出る', () => {
    const app = new cdk.App();
    const stack = new CareQuestStack(app, 'NoEmailStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Subscription', 0);

    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('alertEmail'),
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('意図的に外すときは警告を消せる', () => {
    const app = new cdk.App({ context: { allowNoAlertEmail: true } });
    const stack = new CareQuestStack(app, 'OptOutStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('alertEmail'),
    );
    expect(warnings.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API Gateway メソッド – /entries の GET・POST に COGNITO_USER_POOLS オーソライザ
// ─────────────────────────────────────────────────────────────────────────────
describe('API Gateway – Cognito オーソライザ', () => {
  it('/entries GET に COGNITO_USER_POOLS が付いている', () => {
    // AuthorizationType === 'COGNITO_USER_POOLS' かつ AuthorizerId が設定されているメソッド
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      AuthorizationType: 'COGNITO_USER_POOLS',
      AuthorizerId: Match.anyValue(),
    });
  });

  it('/entries POST に COGNITO_USER_POOLS が付いている', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      AuthorizationType: 'COGNITO_USER_POOLS',
      AuthorizerId: Match.anyValue(),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. API Gateway ステージ – スロットリング rate 10 / burst 20
// ─────────────────────────────────────────────────────────────────────────────
describe('API Gateway – スロットリング', () => {
  it('ステージに throttlingRateLimit 10 が設定されている', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      DefaultRouteSettings: Match.absent(), // RestApi は DefaultRouteSettings ではなく
      // MethodSettings か stageName 直下を使う
    });

    // RestApi の deployOptions は MethodSettings として合成される
    // (CDK は throttlingRateLimit/BurstLimit を MethodSettings["*/*"] に変換)
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: Match.arrayWith([
        Match.objectLike({
          ThrottlingRateLimit: 10,
          ThrottlingBurstLimit: 20,
          HttpMethod: '*',
          ResourcePath: '/*',
        }),
      ]),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CloudWatch アラーム 2 件
// ─────────────────────────────────────────────────────────────────────────────
describe('CloudWatch アラーム', () => {
  it('アラームが 2 件存在する', () => {
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    expect(Object.keys(alarms)).toHaveLength(2);
  });

  it('Lambda エラーアラームが存在する', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'CareQuest-Lambda-Errors',
    });
  });

  it('API Gateway 5XX アラームが存在する', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'CareQuest-ApiGateway-5XX',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Budgets – 月額予算が存在する
// ─────────────────────────────────────────────────────────────────────────────
describe('AWS Budgets', () => {
  it('CfnBudget が 1 件存在する', () => {
    template.resourceCountIs('AWS::Budgets::Budget', 1);
  });

  it('月額 10 USD の COST 予算', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: {
          Amount: 10,
          Unit: 'USD',
        },
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Lambda – inline ZipFile ではなくアセット (S3Bucket/S3Key) 参照
// ─────────────────────────────────────────────────────────────────────────────
describe('Lambda – Code.fromAsset', () => {
  it('Lambda が S3Bucket/S3Key 参照 (fromAsset) を使用している', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Code: {
        S3Bucket: Match.anyValue(),
        S3Key: Match.anyValue(),
      },
    });
  });

  it('Lambda が inline ZipFile を使用していない', () => {
    // ZipFile を持つ Lambda Function が存在しないことを確認
    const functions = template.findResources('AWS::Lambda::Function', {
      Properties: {
        Code: {
          ZipFile: Match.anyValue(),
        },
      },
    });
    // ZipFile を使う Lambda は 0 件
    expect(Object.keys(functions)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 匿名フィードバック API
// ─────────────────────────────────────────────────────────────────────────────

describe('匿名フィードバック', () => {
  it('DynamoDB テーブルが 2 件(entries + feedback)', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 2);
  });

  it('Lambda 関数が 3 件(entries + feedback + weekly digest)', () => {
    template.resourceCountIs('AWS::Lambda::Function', 3);
  });

  it('廃止した record-time API リソースが存在しない', () => {
    const recordTimeResources = template.findResources('AWS::ApiGateway::Resource', {
      Properties: { PathPart: 'record-time' },
    });
    expect(Object.keys(recordTimeResources)).toHaveLength(0);
  });

  it('週次ダイジェストのスケジュールが存在する', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(0 0 ? * MON *)',
    });
  });

  it('COGNITO 認証付きメソッドは entries の GET/POST/DELETE の 3 件(feedback は匿名)', () => {
    const cognitoMethods = template.findResources('AWS::ApiGateway::Method', {
      Properties: { AuthorizationType: 'COGNITO_USER_POOLS' },
    });
    expect(Object.keys(cognitoMethods)).toHaveLength(3);
  });
});
