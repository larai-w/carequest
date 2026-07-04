#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CareQuestStack } from '../lib/carequest-stack';

const app = new cdk.App();
new CareQuestStack(app, 'CareQuestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '000000000000',
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});
