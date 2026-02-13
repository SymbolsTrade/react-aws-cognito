import { Amplify } from 'aws-amplify'

const {
  VITE_COGNITO_REGION,
  VITE_USER_POOL_ID,
  VITE_USER_POOL_CLIENT_ID,
  VITE_COGNITO_DOMAIN,
  VITE_REDIRECT_URL,
  VITE_SIGNOUT_REDIRECT_URL,
  VITE_OAUTH_SCOPES
} = import.meta.env

Amplify.configure({
  Auth: {
    Cognito: {
      region: VITE_COGNITO_REGION,
      userPoolId: VITE_USER_POOL_ID,
      userPoolClientId: VITE_USER_POOL_CLIENT_ID,
      loginWith: { email: true, username: true },
      oauth: (VITE_COGNITO_DOMAIN && VITE_COGNITO_DOMAIN.trim() !== '' && VITE_COGNITO_DOMAIN !== 'NONE') ? {
        domain: VITE_COGNITO_DOMAIN,
        scopes: (VITE_OAUTH_SCOPES || 'openid,email,profile')
          .split(',').map(s => s.trim()).filter(Boolean),
        redirectSignIn: [VITE_REDIRECT_URL || window.location.origin + '/dashboard'],
        redirectSignOut: [VITE_SIGNOUT_REDIRECT_URL || window.location.origin + '/'],
        responseType: 'code',
      } : undefined,
    },
  },
});