"use client";

import { Amplify, type ResourcesConfig } from "aws-amplify";

const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
      loginWith: {
        username: true,
      },
    },
  },
};

Amplify.configure(amplifyConfig);
