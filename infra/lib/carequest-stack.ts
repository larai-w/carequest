import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

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
    });

    const apiHandler = new lambda.Function(this, 'CareQuestApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamodb = new DynamoDBClient({});

function toAttributeValue(value) {
  if (value === null || value === undefined) {
    return { NULL: true };
  }
  if (Array.isArray(value)) {
    return { L: value.map(toAttributeValue) };
  }
  if (typeof value === 'object') {
    return {
      M: Object.fromEntries(
        Object.entries(value).map(([key, childValue]) => [key, toAttributeValue(childValue)])
      ),
    };
  }
  if (typeof value === 'number') {
    return { N: String(value) };
  }
  if (typeof value === 'boolean') {
    return { BOOL: value };
  }
  return { S: String(value) };
}

function fromAttributeValue(attributeValue) {
  if ('S' in attributeValue) return attributeValue.S;
  if ('N' in attributeValue) return Number(attributeValue.N);
  if ('BOOL' in attributeValue) return attributeValue.BOOL;
  if ('NULL' in attributeValue) return null;
  if ('L' in attributeValue) return attributeValue.L.map(fromAttributeValue);
  if ('M' in attributeValue) {
    return Object.fromEntries(
      Object.entries(attributeValue.M).map(([key, childValue]) => [key, fromAttributeValue(childValue)])
    );
  }
  return undefined;
}

function toItem(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, toAttributeValue(value)])
  );
}

function fromItem(item) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, fromAttributeValue(value)])
  );
}

const ALLOWED_ORIGINS = ['https://veai.jp', 'http://localhost:3000'];

function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers['origin'] || event.headers['Origin'])) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  const corsHeaders = getCorsHeaders(event);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Extract user ID from Cognito authorizer
  const authorizer = event.requestContext?.authorizer;
  const userId = authorizer?.claims?.['cognito:username'] || authorizer?.claims?.sub || 'anonymous';

  if (event.httpMethod === 'GET' && event.resource === '/health') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'ok' })
    };
  }

  if (event.httpMethod === 'GET' && event.resource === '/entries') {
    try {
      const params = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'pk = :userId',
        ExpressionAttributeValues: { ':userId': { S: userId } }
      };
      const result = await dynamodb.send(new QueryCommand(params));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify((result.Items || []).map(fromItem))
      };
    } catch (error) {
      console.error('Query error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Error fetching entries' })
      };
    }
  }

  if (event.httpMethod === 'POST' && event.resource === '/entries') {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const item = {
        pk: userId,
        sk: new Date().toISOString(),
        ...body,
        userId: userId,
      };
      await dynamodb.send(new PutItemCommand({ TableName: process.env.TABLE_NAME, Item: toItem(item) }));
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, item })
      };
    } catch (error) {
      console.error('Put error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Error saving entry' })
      };
    }
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ message: 'Not found' })
  };
};
      `),
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
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ALLOWED_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const health = api.root.addResource('health');
    health.addMethod('GET', new apigateway.LambdaIntegration(apiHandler));

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

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TableName', { value: entriesTable.tableName });
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS トピック ARN。メール購読は cdk deploy -c alertEmail=YOUR_EMAIL で追加可能。',
    });
  }
}
