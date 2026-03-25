import {
    ApplicationConfig,
    provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth, LogLevel, authInterceptor } from 'angular-auth-oidc-client';
import { appRoutes } from './app.routes';
import { dpopInterceptor } from './dpop.interceptor';
import { PrivilegeChecker } from '@tai/ui-design-system';
import { AuthService } from './auth.service';

const SYSTEM_CONFIG = {
    gatewayPort: 5217,
    identityPath: '/identity'
};

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(appRoutes),
        { provide: PrivilegeChecker, useExisting: AuthService },
        // provideHttpClient is how we configure Angular's HttpClient.
        // The 'withInterceptors' function is used to register our custom interceptors.
        // The interceptors will be executed in the order they are provided.
        provideHttpClient(withInterceptors([authInterceptor(), dpopInterceptor])),
        // Configure the OpenID Connect (OIDC) client from the 'angular-auth-oidc-client' library.
        // This handles the authentication flow with our Identity Server (OpenIddict).
        provideAuth({
            config: {
                // JUNIOR RATIONALE: We use the root domain as the authority. 
                // This matches the 'Clean Root' backend strategy where the 
                // issuer is simply the gateway URL.
                authority: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}`, 
                authWellknownEndpoints: {
                    issuer: `http://${window.location.hostname}:${SYSTEM_CONFIG.gatewayPort}/`,
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
                scope: 'openid profile email offline_access roles',
                responseType: 'code',
                silentRenew: true,
                useRefreshToken: true,
                autoUserInfo: false,
                renewTimeBeforeTokenExpiresInSeconds: 30,
                logLevel: LogLevel.Debug,
                secureRoutes: ['/api'],
            },
        }),
    ],
};
