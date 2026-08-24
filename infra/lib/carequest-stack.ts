import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import * as path from 'path';

// 本番許可オリジン（開発環境は localhost:3000 も含む）
const ALLOWED_ORIGINS = ['https://veai.jp', 'http://localhost:3000'];

export class CareQuestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'CareQuestUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
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
      // SEC-2026-0818: MFA 有効化（TOTP のみ、SMS はコスト・信頼性の問題で無効）
      // 段階的導入: まず OPTIONAL で開始し、周知後に REQUIRED に変更可能
      // REQUIRED にする場合: mfa: cognito.Mfa.REQUIRED
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true, // TOTP (Google Authenticator, Authy 等)
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'CareQuestUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    const entriesTable = new dynamodb.Table(this, 'CareQuestEntriesTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // T29: データ喪失リスク(R-02)軽減。非推奨の pointInTimeRecovery(boolean) ではなく
      // pointInTimeRecoverySpecification を使用(CDK 推奨の新 API)
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      // OPS-04 (PGB 2026-08-12 承認): 誤削除の保護。CLI で入れると次の
      // cdk deploy で戻るため、IaC 側に置く
      deletionProtection: true,
    });

    // Lambda コードは infra/lambda/entries/ に切り出し済み。
    // synth は cdk.json により ts-node で lib/ を実行するため __dirname は infra/lib。
    // ただしコンパイル後(dist/lib)からの実行にも耐えるよう、__dirname 内の
    // '/dist' セグメントを取り除いてから infra ルート基準で解決する。
    const infraRoot = __dirname.replace(`${path.sep}dist`, '').replace(`${path.sep}lib`, '');
    const lambdaEntriesPath = path.join(infraRoot, 'lambda', 'entries');

    const apiHandler = new lambda.Function(this, 'CareQuestApiHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(lambdaEntriesPath),
      environment: {
        TABLE_NAME: entriesTable.tableName,
        CORS_ENABLED: 'true',
      },
    });

    entriesTable.grantReadWriteData(apiHandler);

    // Lambda のロググループ保持期間を明示（3ヶ月 = 90日）
    new logs.LogGroup(this, 'CareQuestApiHandlerLogGroup', {
      logGroupName: `/aws/lambda/${apiHandler.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const api = new apigateway.RestApi(this, 'CareQuestApi', {
      restApiName: 'CareQuest API',
      deployOptions: {
        stageName: 'dev',
        // T29: 課金攻撃リスク(R-05)軽減。個人アプリの想定スループットに合わせた
        // 緩やかなスロットリング(10 rps / バースト 20)。API キーなしで
        // アカウント全体の上限(10,000 rps)に達することを防ぐ防波堤
        throttlingRateLimit: 10,
        throttlingBurstLimit: 20,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ALLOWED_ORIGINS,
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const health = api.root.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(apiHandler));

    // T54: 今日のともしび。匿名の distinct ユーザー数のみを返すため認証なし
    // (みんな/あゆみ画面はサインインなしで見られる)。
    const presence = api.root.addResource('presence');
    presence.addMethod('GET', new apigateway.LambdaIntegration(apiHandler));

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CareQuestApiAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CareQuestUserPoolAuthorizer',
      identitySource: apigateway.IdentitySource.header('Authorization'),
    });

    const entries = api.root.addResource('entries');
    entries.addMethod('GET', new apigateway.LambdaIntegration(apiHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    entries.addMethod('POST', new apigateway.LambdaIntegration(apiHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    // US-503: 認証ユーザー自身のクラウド記録をすべて削除(端末の記録は消さない)。
    entries.addMethod('DELETE', new apigateway.LambdaIntegration(apiHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ─── 匿名フィードバック(ご意見)────────────────────────────────────────
    // 認証なしで受け付ける(匿名性の担保)。ステージ全体のスロットリング
    // (10 rps)が濫用の防波堤。保存するのは mood と任意の note のみで、
    // ユーザー識別子・IP は保存しない。
    const feedbackTable = new dynamodb.Table(this, 'CareQuestFeedbackTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // 本番では PITR が有効なのにコードに無く、次の deploy で無効へ
      // 戻りうる状態だった(2026-08-24 の実測で判明)。実態に合わせる
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      // OPS-04 (PGB 2026-08-12 承認): 誤削除の保護
      deletionProtection: true,
    });

    const feedbackHandler = new lambda.Function(this, 'CareQuestFeedbackHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(infraRoot, 'lambda', 'feedback')),
      environment: {
        FEEDBACK_TABLE_NAME: feedbackTable.tableName,
      },
    });

    feedbackTable.grantWriteData(feedbackHandler);

    new logs.LogGroup(this, 'CareQuestFeedbackHandlerLogGroup', {
      logGroupName: `/aws/lambda/${feedbackHandler.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const feedback = api.root.addResource('feedback');
    feedback.addMethod('POST', new apigateway.LambdaIntegration(feedbackHandler));

    // ─── 監視・アラート (T14) ───────────────────────────────────────────────

    // アラート通知用 SNS トピック
    const alertTopic = new sns.Topic(this, 'CareQuestAlertTopic', {
      topicName: 'CareQuestAlerts',
      displayName: 'Care Quest Alerts',
    });

    // CDK context (-c alertEmail=...) または環境変数がある場合のみメール購読を追加
    // デプロイ時: cdk deploy -c alertEmail=your@email.com
    const alertEmail =
      this.node.tryGetContext('alertEmail') ??
      process.env.ALERT_EMAIL;
    if (alertEmail) {
      alertTopic.addSubscription(
        new sns_subscriptions.EmailSubscription(alertEmail as string),
      );
    }

    // 週次フィードバックダイジェスト: 毎週月曜 09:00 JST(= 日曜 00:00 UTC の翌日 0時 UTC)に
    // 直近7日の匿名フィードバックを集計し、既存のアラートメール購読へ送る。
    const feedbackDigestHandler = new lambda.Function(this, 'CareQuestFeedbackDigestHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(infraRoot, 'lambda', 'feedback-digest')),
      environment: {
        FEEDBACK_TABLE_NAME: feedbackTable.tableName,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
      },
    });
    feedbackTable.grantReadData(feedbackDigestHandler);
    alertTopic.grantPublish(feedbackDigestHandler);

    new logs.LogGroup(this, 'CareQuestFeedbackDigestLogGroup', {
      logGroupName: `/aws/lambda/${feedbackDigestHandler.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new events.Rule(this, 'CareQuestFeedbackDigestSchedule', {
      // 月曜 00:00 UTC = 月曜 09:00 JST
      schedule: events.Schedule.cron({ minute: '0', hour: '0', weekDay: 'MON' }),
      targets: [new events_targets.LambdaFunction(feedbackDigestHandler)],
    });

    // CloudWatch アラーム: Lambda エラー (Errors >= 1、5分間)
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: 'CareQuest-Lambda-Errors',
      alarmDescription:
        'Lambda 関数で 5 分以内に 1 件以上のエラーが発生しました。runbook の Lambda エラー手順を参照してください。',
      metric: apiHandler.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // CloudWatch アラーム: API Gateway 5XX (>= 1、5分間)
    const apiGateway5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: 'CareQuest-ApiGateway-5XX',
      alarmDescription:
        'API Gateway で 5 分以内に 1 件以上の 5XX エラーが発生しました。runbook の API Gateway 手順を参照してください。',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: 'CareQuest API',
          Stage: 'dev',
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiGateway5xxAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // AWS Budgets: 月額コストアラート (月 10 USD、80% 超過で通知)
    // Budgets の通知先も alertEmail/ALERT_EMAIL が設定されている場合のみ購読
    const budgetNotificationSubscribers: budgets.CfnBudget.SubscriberProperty[] = alertEmail
      ? [{ subscriptionType: 'EMAIL', address: alertEmail as string }]
      : [];

    new budgets.CfnBudget(this, 'CareQuestMonthlyBudget', {
      budget: {
        budgetName: 'CareQuestMonthlyBudget',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: 10,
          unit: 'USD',
        },
      },
      notificationsWithSubscribers: budgetNotificationSubscribers.length > 0
        ? [
            {
              notification: {
                notificationType: 'ACTUAL',
                comparisonOperator: 'GREATER_THAN',
                threshold: 80,
                thresholdType: 'PERCENTAGE',
              },
              subscribers: budgetNotificationSubscribers,
            },
          ]
        : [],
    });

    // ─── Outputs ────────────────────────────────────────────────────────────

    // この User Pool は veai.jp 全アプリ共通の「VEAI アカウント」基盤。
    // 他アプリのスタックは exportName 経由で参照し、アプリごとに別の UserPoolClient を作る
    // (docs/auth-architecture.md 参照)。exportName があるあいだ Pool は削除できなくなる。
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      exportName: 'VeaiSharedUserPoolId',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TableName', { value: entriesTable.tableName });
    new cdk.CfnOutput(this, 'FeedbackTableName', { value: feedbackTable.tableName });
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS トピック ARN。メール購読は cdk deploy -c alertEmail=YOUR_EMAIL で追加可能。',
    });
  }
}
