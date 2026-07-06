import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

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

    const api = new apigateway.RestApi(this, 'CareQuestApi', {
      restApiName: 'CareQuest API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
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

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TableName', { value: entriesTable.tableName });
  }
}
