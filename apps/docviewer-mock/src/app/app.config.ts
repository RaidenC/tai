import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth, LogLevel, authInterceptor } from 'angular-auth-oidc-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor()])),
    provideAuth({
      config: {
        authority: `http://${window.location.hostname}:5217`,
        authWellknownEndpoints: {
            issuer: `http://${window.location.hostname}:5217/`,
            authorizationEndpoint: `http://${window.location.hostname}:5217/identity/connect/authorize`,
            tokenEndpoint: `http://${window.location.hostname}:5217/identity/connect/token`,
            userInfoEndpoint: `http://${window.location.hostname}:5217/identity/connect/userinfo`,
            jwksUri: `http://${window.location.hostname}:5217/identity/.well-known/jwks`,
            revocationEndpoint: `http://${window.location.hostname}:5217/identity/connect/logout`,
            introspectionEndpoint: `http://${window.location.hostname}:5217/identity/connect/introspect`,
        },
        redirectUrl: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        clientId: 'portal-web', // Using the same client ID for simple federation POC
        scope: 'openid profile email offline_access roles',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        autoUserInfo: false,
        logLevel: LogLevel.Debug,
        secureRoutes: ['/api'],
      },
    }),
  ],
};
