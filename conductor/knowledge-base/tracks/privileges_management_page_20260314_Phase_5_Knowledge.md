# Knowledge Note: SignalR & Authentication Compatibility (Phase 5)

## 🎯 Objective
Research and prototype the integration of SignalR within a Zero-Trust architecture, ensuring compatibility with BFF (Backend-for-Frontend) cookie-based authentication and DPoP (Demonstrating Proof-of-Possession) token binding.

## 🏗️ Architectural Decisions

### 1. Dual-Scheme Authentication
The SignalR Hub is configured to accept both `OpenIddict` (JWT) and `Identity.Application` (Cookie) schemes. This allows the system to transition from the current "JWT-in-browser" pattern to the mandated "BFF" pattern without breaking existing functionality.

```csharp
[Authorize(AuthenticationSchemes = $"{OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme},Identity.Application")]
public class NotificationHub : Hub { ... }
```

### 2. Gateway-Assisted DPoP Injection
Since browser-based SignalR clients (WebSockets) cannot send custom headers like `DPoP` during the handshake, the architecture delegates this to the **Gateway (BFF)**. 
- **The Flow:** The browser sends a session cookie to the Gateway. The Gateway, acting as the trusted BFF, fetches the associated JWT and generates a DPoP proof before proxying the request to the backend.

### 3. YARP Proxy Support
YARP correctly handles the SignalR handshake (Negotiate + Upgrade) and preserves custom headers across the proxy boundary. The `X-Gateway-Secret` trust mechanism is enforced for all SignalR requests.

## 🧪 Verification Evidence

### Integration Test: `SignalRAuthTests.cs`
Three core scenarios were verified using `WebApplicationFactory`:
- **JWT Success:** Authenticating with a Bearer token + DPoP header.
- **Cookie Success:** Authenticating with the `.AspNetCore.Identity.Application` cookie (proving BFF readiness).
- **Unauthorized Failure:** Ensuring that unauthenticated requests are rejected with `401 Unauthorized` during the negotiation phase.

### Execution Metrics
- **Hub Initialization:** Successfully integrated into `portal-api`.
- **Gateway Routing:** Successfully added `/hubs/` catch-all route.
- **DPoP Compatibility:** Verified that adding DPoP headers doesn't disrupt the SignalR handshake.

## 💡 Lessons Learned
- **Trust Middleware Order:** `GatewayTrustMiddleware` MUST allow SignalR Negotiate requests (or be provided with the secret) to avoid `403 Forbidden` errors.
- **Tenant Resolution:** SignalR requests are correctly intercepted by `TenantResolutionMiddleware`, ensuring that real-time events can be scoped to the correct institution.

## 🚀 Next Steps (Phase 6)
Implement the `*hasPrivilege` structural directive and the real-time SignalR listener for immediate UI degradation on privilege revocation.

---
*Created: March 2026*
