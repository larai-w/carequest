"use client";

import { Amplify, type ResourcesConfig } from "aws-amplify";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

if (userPoolId && userPoolClientId) {
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
}
