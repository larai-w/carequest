/**
 * T28 – CDK assertions テスト
 * aws-cdk-lib/assertions の Template を使って fine-grained アサーションを行う。
 * スナップショットテストは使わず、各プロパティを個別に検証する。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CareQuestStack } from '../lib/carequest-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new CareQuestStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  template = Template.fromStack(stack);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cognito UserPool – DeletionPolicy が Retain
// ─────────────────────────────────────────────────────────────────────────────
describe('Cognito UserPool', () => {
  it('DeletionPolicy が Retain', () => {
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
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
