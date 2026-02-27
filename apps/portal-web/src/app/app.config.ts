import {
    ApplicationConfig,
    provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth, LogLevel } from 'angular-auth-oidc-client';
import { appRoutes } from './app.routes';
import { dpopInterceptor } from './dpop.interceptor';

const SYSTEM_CONFIG = {
    gatewayPort: 5217,
    identityPath: '/identity'
};

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(appRoutes),
        // provideHttpClient is how we configure Angular's HttpClient.
        // The 'withInterceptors' function is used to register our custom interceptors.
        // The interceptors will be executed in the order they are provided.
        provideHttpClient(withInterceptors([dpopInterceptor])),
        // Configure the OpenID Connect (OIDC) client from the 'angular-auth-oidc-client' library.
        // This handles the authentication flow with our Identity Server (OpenIddict).
        provideAuth({
            config: {
                // JUNIOR RATIONALE: We make the authority dynamic so that if you 
                // visit 'acme.localhost', the app talks to the Gateway using 
                // that same domain. This allows the backend to know which bank 
                // you are trying to access.
                authority: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}`, 
                authWellknownEndpoints: {
                    issuer: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}`,
                    authorizationEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/authorize`,
                    tokenEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/token`,
                    userInfoEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/userinfo`,
                    jwksUri: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/.well-known/jwks`,
                    revocationEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/logout`,
                    introspectionEndpoint: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}${SYSTEM_CONFIG.identityPath}/connect/introspect`,
                },
                redirectUrl: window.location.origin,
                postLogoutRedirectUri: window.location.origin,
                clientId: 'portal-web',
                scope: 'openid profile email roles',
                responseType: 'code',
                silentRenew: true,
                useRefreshToken: true,
                autoUserInfo: false,
                renewTimeBeforeTokenExpiresInSeconds: 30,
                logLevel: LogLevel.Debug,
            },
        }),
    ],
};
