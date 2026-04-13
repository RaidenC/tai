---
title: System Design & Architecture
difficulty: L2 | L3 | Staff
lastUpdated: 2026-04-10
relatedTopics:
  - DDD-Domain-Modeling
  - MediatR-CQRS
  - Distributed-Systems
  - Design-Patterns
  - EFCore-SQL
  - Authentication-Authorization
  - SignalR-Realtime
  - Security-CSP-DPoP
  - Logging-Observability
---

## TL;DR

`tai-portal` is a **multi-tenant, AI-native SaaS** built as an Nx monorepo with a clear layered architecture: **Angular 21 frontend** → **YARP API Gateway** (rate limiting, secret injection, WebSocket proxying) → **ASP.NET Core API** (OpenIddict identity, MediatR CQRS, EF Core with PostgreSQL). This note covers the **system-level architectural decisions**: the gateway as the security perimeter, three-layer tenant isolation, the middleware pipeline ordering that enforces Zero Trust, and AI-native design with cost awareness. For CQRS pipeline details see [[MediatR-CQRS]], for domain modeling see [[DDD-Domain-Modeling]], for resilience patterns see [[Distributed-Systems]].

## Deep Dive

### Concept Overview

#### 1. The YARP API Gateway — Edge Security & Routing
- **What:** YARP (Yet Another Reverse Proxy) is Microsoft's high-performance reverse proxy library. In `tai-portal`, it acts as the single entry point for all traffic — API requests, WebSocket connections, OIDC flows, and static assets. It routes to a single backend cluster and injects the `X-Gateway-Secret` header on every forwarded request.
- **Why:** The gateway centralizes cross-cutting concerns that would otherwise be duplicated across services: rate limiting, CORS, TLS termination, and trust injection. No client can reach the API directly — every request must pass through the gateway, which acts as the security perimeter.
- **How:** YARP loads its route table from `appsettings.json`. Six routes cover all traffic patterns: `/api/**` (REST), `/hubs/**` (WebSocket with explicit `WebSocket.Enabled`), `/connect/**` (OIDC with rate limiting), `/identity/**` (with path prefix removal and tenant host injection), `/.well-known/**` (OIDC discovery), and `/Account/**` (login UI). A code-level transform injects `X-Gateway-Secret` into every forwarded request:
  ```csharp
  builder.Services.AddReverseProxy()
      .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
      .AddTransforms(ctx => ctx.AddRequestHeader("X-Gateway-Secret", secret));
  ```
- **When:** Use a reverse proxy gateway for any production deployment with more than one backend service, or when you need to enforce edge-level security that the backend shouldn't manage (rate limiting, WAF, mutual TLS).
- **Trade-offs:** The gateway is a single point of failure. If YARP crashes, all traffic stops. In production, you'd deploy multiple gateway instances behind a cloud load balancer (ALB/NLB). Also, YARP adds ~1-2ms latency per request for header injection and routing.

#### 2. Multi-Tenancy — Three-Layer Isolation
- **What:** Multi-tenancy means a single deployment serves multiple isolated customers (tenants). In `tai-portal`, tenancy is enforced at three layers: request resolution, database query filtering, and real-time event routing.
- **Why:** Running a separate deployment per tenant is operationally expensive and doesn't scale beyond ~50 tenants. Shared infrastructure with logical isolation gives you the economics of multi-tenancy with the security guarantees of isolation.
- **How:**
  1. **Request layer:** `TenantResolutionMiddleware` reads the `Host` header (e.g., `acme.localhost`), looks up the tenant in the database (cached for 15 minutes), and sets `ITenantService.TenantId` for the current request scope.
  2. **Database layer:** Global Query Filters on `ApplicationUser`, `Tenant`, and `AuditEntry` automatically append `WHERE TenantId = @current`. `TenantInterceptor` stamps `TenantId` on every new entity.
  3. **Real-time layer:** `NotificationHub.OnConnectedAsync()` adds connections to a group keyed by `tenant_id` claim. All server pushes use `Clients.Group(tenantId)`.
- **When:** Use host-based tenant resolution when tenants have custom domains or subdomains. Use header-based or claim-based resolution for API-only tenancy.
- **Trade-offs:** Shared-database tenancy (tai-portal's model) is simple but creates "noisy neighbor" risk — one tenant's heavy query can affect all tenants. For regulated industries, consider schema-per-tenant or database-per-tenant isolation tiers (see the EF Core note's Staff Q&A for a detailed design).

#### 3. The Middleware Pipeline — Order Matters
- **What:** The ASP.NET Core middleware pipeline processes requests in order and responses in reverse order. Each middleware can short-circuit the pipeline (returning early) or pass the request to the next middleware.
- **Why:** Middleware order determines security guarantees. If authentication runs before gateway trust validation, an attacker could bypass the gateway. If CORS runs after authentication, preflight requests would fail.
- **How:** The `portal-api` pipeline order is deliberately sequenced:
  1. **Exception handling** (inline lambda) — catches `ValidationException` → 400
  2. **Forwarded headers** — corrects client IP from proxy headers
  3. **Routing** — maps request to endpoint
  4. **CORS** — validates origin allow-list
  5. **Gateway trust** — validates `X-Gateway-Secret` (rejects direct access)
  6. **Authentication** — validates JWT/cookie via OpenIddict
  7. **Authorization** — checks `[Authorize]` policies
  8. **Tenant resolution** — resolves tenant from host, sets `ITenantService`
  9. **Endpoints** — controllers and SignalR hubs
- **When:** Always diagram your middleware pipeline when designing a new service. Reordering middleware is the most common source of auth bypass vulnerabilities.
- **Trade-offs:** Each middleware adds latency. For high-throughput services, consider whether all middleware is needed on every path. `tai-portal` applies all middleware to all routes — acceptable for a POC, but production might use endpoint-specific middleware branching (`app.Map("/api", ...)`) to skip unnecessary processing.

#### 4. AI-Native Architecture — Orchestration, Inference & Cost
- **What:** Modern system design separates the AI orchestration layer (prompt building, RAG retrieval, guardrails, context management) from the inference layer (actual LLM API calls). This allows hot-swapping providers and implementing cost controls. FinOps treats infrastructure cost as a first-class architectural concern — critical in AI-native systems where inference costs can dominate the entire bill.
- **Why:** LLM inference is expensive ($15-75 per million tokens for frontier models), latency-variable (100ms-10s), and unreliable (rate limits, outages). A poorly designed RAG pipeline that sends 50KB of context per query at $15/M tokens costs $0.75 per query. At 10,000 queries/day, that's $225,000/month. Cost must be designed into the system, not discovered in the bill.
- **How:** The orchestration layer handles:
  1. **Context assembly** — RAG retrieval from vector DB, tool/function schema injection
  2. **Security guardrails** — input/output filtering, PII redaction, token budget limits
  3. **Provider abstraction** — route to GPT-4o, Claude, or a local model based on cost/latency requirements
  4. **Cost controls** — semantic caching (cosine similarity > 0.95), tiered models (simple → cheap, complex → frontier), per-tenant token budgets, prompt optimization, async batching for off-peak pricing
  5. **Streaming** — SSE or WebSocket delivery of partial responses to the frontend
- **When:** Use this separation for any production AI system. Even for POCs, abstracting the provider prevents technical debt when you inevitably switch models. Always set budget alerts before deploying any LLM-integrated feature.
- **Trade-offs:** The abstraction layer adds latency (~5-20ms for prompt assembly and routing). Cost optimization often conflicts with quality — smaller models are cheaper but less accurate, shorter context windows miss relevant information. The optimal balance depends on the use case.

```mermaid
flowchart TB
    subgraph Client["Angular Frontend :4200"]
        APP["App Shell"]
        DPoP["DPoP Service"]
        RT["RealTimeService"]
    end

    subgraph Gateway["YARP Gateway :5217"]
        RL["Rate Limiter<br/>Token Bucket by IP"]
        CORS["CORS Middleware"]
        SEC["X-Gateway-Secret<br/>Injection"]
        WS["WebSocket Proxy"]
    end

    subgraph API["ASP.NET Core API :5031"]
        GTM["GatewayTrustMiddleware"]
        AUTH["OpenIddict Validation"]
        TENANT["TenantResolutionMiddleware"]
        MED["MediatR Pipeline"]
        VAL["ValidationBehavior"]
        CMD["Command / Query Handlers"]
    end

    subgraph Domain["Domain Layer"]
        ENT["Entities<br/>ApplicationUser, Privilege"]
        EVT["Domain Events<br/>UserApproved, PrivilegeModified"]
        VO["Value Objects<br/>TenantId, PrivilegeId"]
    end

    subgraph Infra["Infrastructure Layer"]
        DBCTX["PortalDbContext"]
        QF["Global Query Filters"]
        INTC["TenantInterceptor"]
        DISP["Event Dispatch<br/>in SaveChangesAsync"]
        NOTIFY["IRealTimeNotifier<br/>SignalR push"]
        BUS["IMessageBus<br/>stub for future broker"]
    end

    subgraph DB["PostgreSQL"]
        USERS["AspNetUsers"]
        AUDIT["AuditLogs<br/>PARTITION BY RANGE"]
        PRIV["Privileges<br/>jsonb columns"]
    end

    APP -->|"DPoP + Cookie"| Gateway
    RT -->|"WebSocket"| WS
    Gateway --> RL --> CORS --> SEC
    SEC -->|"X-Gateway-Secret"| API
    WS -->|"WebSocket Upgrade"| API
    API --> GTM --> AUTH --> TENANT --> MED
    MED --> VAL --> CMD
    CMD --> ENT
    ENT --> EVT
    CMD --> DBCTX
    DBCTX --> QF --> DB
    DBCTX --> INTC
    DBCTX --> DISP
    DISP --> NOTIFY
    DISP --> BUS

    style Client fill:#1a1a2e,stroke:#e94560,color:#fff
    style Gateway fill:#16213e,stroke:#0f3460,color:#fff
    style API fill:#0f3460,stroke:#53d8fb,color:#fff
    style Domain fill:#1a1a2e,stroke:#53d8fb,color:#fff
    style Infra fill:#16213e,stroke:#e94560,color:#fff
    style DB fill:#0f3460,stroke:#53d8fb,color:#fff
```

---

## Real-World Code Examples

### 1. YARP Gateway Configuration — Routes & Transforms

The complete gateway setup with rate limiting and secret injection:

```csharp
// apps/portal-gateway/Program.cs (lines 11-50)

// Rate limiter — token bucket by client IP
builder.Services.AddRateLimiter(options => {
    options.AddPolicy("token-bucket", httpContext =>
        RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new TokenBucketRateLimiterOptions {
                TokenLimit = 10,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                TokensPerPeriod = 10,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// YARP with secret injection transform
var gatewaySecret = builder.Configuration["GATEWAY_SECRET"]
    ?? builder.Configuration["Gateway:Secret"]
    ?? "portal-poc-secret-2026";

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(builderContext => {
        builderContext.AddRequestHeader("X-Gateway-Secret", gatewaySecret);
    });
```

```json
// apps/portal-gateway/appsettings.json — route table (abbreviated)
{
  "ReverseProxy": {
    "Routes": {
      "ApiRoute":       { "ClusterId": "IdentityCluster", "Match": { "Path": "/api/{**catch-all}" } },
      "SignalRRoute":   { "ClusterId": "IdentityCluster", "Match": { "Path": "/hubs/{**catch-all}" },
                          "WebSocket": { "Enabled": true } },
      "OidcConnectRoute": { "ClusterId": "IdentityCluster", "Match": { "Path": "/connect/{**catch-all}" },
                            "RateLimiterPolicy": "token-bucket" }
    },
    "Clusters": {
      "IdentityCluster": {
        "Destinations": { "Default": { "Address": "http://127.0.0.1:5031/" } }
      }
    }
  }
}
```

**Why this matters:** Rate limiting applies only to `/connect/**` (OIDC token endpoint) — the most abuse-prone endpoint. API and WebSocket routes are not rate-limited at the gateway (application-level throttling would be added per-endpoint). The secret injection is a code-level transform, not a route config — it applies to all routes uniformly.

#### X-Gateway-Secret — Rotation, Generation, and Cloud-Native Implementation

**Generation:** Use a cryptographically random string (256-bit minimum):

```csharp
Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
```

**Rotation intervals:**

| Environment | Interval | Reasoning |
|-------------|----------|-----------|
| High security | Every 24–72 hours | Limits exposure window |
| Typical production | Every 30–90 days | Balances security vs. operational burden |
| Compliance-driven (PCI, SOC2) | Every 90 days max | Audit requirement |

**Zero-downtime rotation via dual-secret acceptance:** During rotation the backend accepts both old and new secrets for a brief grace period (5–10 minutes), then drops the old one:

```csharp
// GatewayTrustMiddleware with rotation support
var secrets = _config.GetSection("Gateway:AcceptedSecrets").Get<string[]>();
var received = context.Request.Headers["X-Gateway-Secret"].ToString().Trim();
if (!secrets.Any(s => string.Equals(s.Trim(), received, StringComparison.OrdinalIgnoreCase)))
{
    context.Response.StatusCode = 403;
    return;
}
```

**AWS cloud-native implementation:**

```mermaid
flowchart TD
    Lambda["Rotation Lambda<br/>runs every N days"]
    SM["AWS Secrets Manager<br/>stores current + pending secrets"]
    APIGW["API Gateway<br/>(or ALB + Lambda Authorizer)"]
    API["ECS / EKS Backend<br/>(validates secret)"]

    Lambda -- "rotates secret" --> SM
    SM -- "reads (cached)" --> APIGW
    SM -- "reads (cached)" --> API
    APIGW -- "X-Gateway-Secret header" --> API
```

- **Store the secret in AWS Secrets Manager** with automatic rotation enabled (Lambda rotation function).
- **API Gateway** injects the header via a request integration mapping template or a Lambda authorizer that reads from Secrets Manager (cached).
- **Backend (ECS/EKS)** reads the secret from Secrets Manager at startup and refreshes on a timer or via a sidecar.
- **Alternative: VPC Link private integration** — if API Gateway connects to the backend via a private VPC Link to an internal ALB, network isolation itself provides the trust boundary, making the shared secret less critical.

#### Replacing YARP with AWS API Gateway for Production

In the POC, YARP handles reverse proxying as a .NET in-process gateway. For production on AWS, you would replace YARP with **API Gateway + ALB** while preserving the same security model.

**Target architecture:**

```mermaid
flowchart TD
    subgraph Public
        CF["CloudFront CDN<br/>serves Angular static assets"]
        APIGW["API Gateway<br/>(HTTP API or REST API)"]
    end

    subgraph VPC["Private VPC"]
        ALB["Internal ALB<br/>(not internet-facing)"]
        subgraph ECS["ECS Fargate / EKS"]
            API["portal-api<br/>container"]
        end
        RDS["Amazon RDS<br/>PostgreSQL"]
        CACHE["ElastiCache Redis<br/>jti cache + tenant cache"]
    end

    subgraph Security
        SM["Secrets Manager<br/>Gateway Secret + DB creds"]
        COG["Amazon Cognito<br/>(or self-hosted OpenIddict<br/>on ECS)"]
    end

    CF -- "/api/* /hubs/*" --> APIGW
    APIGW -- "VPC Link<br/>(private integration)" --> ALB
    ALB --> API
    API --> RDS
    API --> CACHE
    SM -. "secret rotation" .-> APIGW
    SM -. "secret rotation" .-> API
    COG -. "token validation" .-> APIGW
```

**What maps from YARP to what in AWS:**

| YARP (POC) | AWS (Production) | Notes |
|------------|-------------------|-------|
| `portal-gateway` process | **API Gateway HTTP API** | Managed, auto-scaling, no servers to patch |
| YARP route config (`appsettings.json`) | **API Gateway routes + integrations** | `/api/{proxy+}` → VPC Link → ALB |
| `AddRequestHeader("X-Gateway-Secret")` | **Lambda Authorizer** or **API Gateway request mapping** | Injects header before forwarding |
| Token Bucket rate limiter | **API Gateway usage plans + throttling** | Per-stage or per-API key throttling built-in |
| YARP WebSocket proxy | **API Gateway WebSocket API** (separate) | WebSocket APIs are a distinct API Gateway type |
| `localhost` routing | **VPC Link** to internal ALB | Traffic never leaves the VPC |

**Step-by-step setup:**

**1. Network foundation — VPC + ALB:**

```mermaid
flowchart LR
    subgraph VPC
        subgraph PublicSubnets["Public Subnets (2 AZs)"]
            NAT["NAT Gateway"]
        end
        subgraph PrivateSubnets["Private Subnets (2 AZs)"]
            ALB["Internal ALB"]
            ECS["ECS Fargate Tasks"]
        end
    end

    ALB -- "Target Group<br/>health check: /health" --> ECS
    ECS -- "outbound via NAT<br/>(pull images, Secrets Manager)" --> NAT
```

- Create a VPC with public + private subnets across 2 AZs.
- Deploy an **internal** (not internet-facing) ALB in the private subnets.
- ECS Fargate tasks run `portal-api` in private subnets, registered as ALB target group.
- ALB security group allows inbound **only** from the VPC Link (API Gateway's ENI).

**2. API Gateway HTTP API + VPC Link:**

```bash
# Create VPC Link to internal ALB
aws apigatewayv2 create-vpc-link \
  --name tai-portal-vpc-link \
  --subnet-ids subnet-private-1a subnet-private-1b \
  --security-group-ids sg-vpclink

# Create HTTP API
aws apigatewayv2 create-api \
  --name tai-portal-api \
  --protocol-type HTTP

# Create integration pointing to ALB via VPC Link
aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type HTTP_PROXY \
  --integration-method ANY \
  --integration-uri arn:aws:elasticloadbalancing:...:listener/... \
  --connection-type VPC_LINK \
  --connection-id $VPC_LINK_ID

# Create catch-all route for /api/*
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "ANY /api/{proxy+}" \
  --target integrations/$INTEGRATION_ID
```

**3. Gateway secret injection via Lambda Authorizer:**

```python
# lambda/gateway_authorizer.py
import boto3, json, os

secrets_client = boto3.client('secretsmanager')
CACHE = {}

def handler(event, context):
    # Fetch gateway secret (cached for Lambda lifetime ~5-15 min)
    if 'gateway_secret' not in CACHE:
        resp = secrets_client.get_secret_value(
            SecretId=os.environ['GATEWAY_SECRET_ARN']
        )
        CACHE['gateway_secret'] = json.loads(resp['SecretString'])['value']

    return {
        "isAuthorized": True,
        "context": {
            # API Gateway adds these as request headers to the integration
            "X-Gateway-Secret": CACHE['gateway_secret']
        }
    }
```

Attach this as a **Lambda Authorizer (request type, payload format 2.0)** on the API Gateway route. API Gateway calls it before forwarding, and the returned `context` values become headers on the backend request.

**4. WebSocket API for SignalR (separate API Gateway):**

```mermaid
sequenceDiagram
    participant Browser
    participant WSGW as API Gateway<br/>WebSocket API
    participant ALB as Internal ALB
    participant Hub as portal-api<br/>SignalR Hub

    Browser->>WSGW: wss://ws.yourapp.com/hubs/notifications
    WSGW->>WSGW: $connect route → Lambda authorizer<br/>validates cookie / token
    WSGW->>ALB: Forward via VPC Link
    ALB->>Hub: WebSocket Upgrade
    Hub-->>Browser: Connected to tenant group
```

- WebSocket APIs in API Gateway are a **separate API type** from HTTP APIs.
- The `$connect` route runs a Lambda authorizer that validates the session cookie.
- Use a custom domain: `ws.yourapp.com` for WebSocket, `api.yourapp.com` for REST.

**5. Rate limiting + throttling:**

```bash
# HTTP API: set default throttle on the stage
aws apigatewayv2 update-stage \
  --api-id $API_ID \
  --stage-name prod \
  --default-route-settings '{"ThrottlingBurstLimit": 100, "ThrottlingRateLimit": 50}'

# Per-route override for /connect/* (auth endpoints — tighter limit)
aws apigatewayv2 update-route \
  --api-id $API_ID \
  --route-id $OIDC_ROUTE_ID \
  --route-settings '{"ThrottlingBurstLimit": 20, "ThrottlingRateLimit": 10}'
```

This replaces the YARP Token Bucket rate limiter with API Gateway's built-in throttling. For more granular control (per-tenant, per-user), add **WAF rate-based rules** on the API Gateway.

**6. Secret rotation (ties back to the X-Gateway-Secret deep dive):**

```mermaid
sequenceDiagram
    participant SM as Secrets Manager
    participant Lambda as Rotation Lambda
    participant APIGW as Lambda Authorizer<br/>(reads secret)
    participant API as portal-api<br/>(validates secret)

    Note over SM,Lambda: Every 30 days (configurable)
    SM->>Lambda: Trigger rotation
    Lambda->>Lambda: Generate new 256-bit secret
    Lambda->>SM: Store as AWSPENDING
    Lambda->>SM: Test new secret
    Lambda->>SM: Promote AWSPENDING → AWSCURRENT
    Note over APIGW,API: Next invocations pick up new secret
    APIGW->>SM: get_secret_value (cached ~5 min)
    API->>SM: get_secret_value (cached ~5 min)
    Note over API: Backend accepts both current + previous<br/>via dual-secret pattern for graceful rollover
```

**7. DNS + CloudFront for the Angular frontend:**

| Domain | Target | Purpose |
|--------|--------|---------|
| `app.yourapp.com` | CloudFront → S3 bucket | Angular SPA static assets |
| `api.yourapp.com` | API Gateway HTTP API custom domain | REST API |
| `ws.yourapp.com` | API Gateway WebSocket API custom domain | SignalR |
| `auth.yourapp.com` | API Gateway → OpenIddict (or Cognito) | OIDC endpoints |

CloudFront serves the Angular app and can also proxy `/api/*` to API Gateway via an **origin group**, avoiding CORS entirely (same domain). This is often the simplest production setup.

**Key differences from the POC to be aware of:**

| Concern | POC (YARP) | Production (AWS) |
|---------|------------|------------------|
| Gateway trust | Shared secret in `appsettings.json` | Secrets Manager with auto-rotation |
| Network isolation | Same machine, different ports | VPC Link, private subnets, security groups |
| CORS | `SetIsOriginAllowed` lambda | CloudFront same-origin proxy eliminates CORS, or API Gateway CORS config |
| SSL | Development certs | ACM certificates on CloudFront + API Gateway |
| Scaling | Single process | API Gateway auto-scales, ECS Fargate auto-scales via target tracking |
| Tenant routing | Host header on localhost subdomains | Route 53 wildcard `*.yourapp.com` → CloudFront → API Gateway |

### 2. Tenant Resolution Middleware — Host-Based Multi-Tenancy

```csharp
// libs/core/infrastructure/Middleware/TenantResolutionMiddleware.cs
public class TenantResolutionMiddleware
{
    public async Task InvokeAsync(HttpContext context, ITenantService tenantService,
        PortalDbContext dbContext, IMemoryCache cache)
    {
        var host = context.Request.Host.Host;

        // Cache tenant lookup for 15 minutes
        var tenantId = await cache.GetOrCreateAsync($"tenant:{host}", async entry => {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);
            var tenant = await dbContext.Tenants
                .IgnoreQueryFilters()  // Must bypass tenant filter to resolve tenant!
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TenantHostname == host);
            return tenant?.Id;
        });

        if (tenantId.HasValue)
        {
            tenantService.SetTenant(tenantId.Value);
        }

        await _next(context);
    }
}
```

**Why this matters:** The middleware must use `IgnoreQueryFilters()` — otherwise the global query filter would prevent finding the tenant (circular dependency: need tenant to query, need query to find tenant). The 15-minute cache prevents a database hit on every request. `AsNoTracking()` avoids Change Tracker overhead for this read-only lookup.

### 3. Global Exception Handling — Inline Middleware

The API's error handling middleware for validation and identity exceptions:

```csharp
// apps/portal-api/Program.cs (lines 170-198)
app.Use(async (context, next) => {
    try
    {
        await next(context);
    }
    catch (FluentValidation.ValidationException ex)
    {
        context.Response.StatusCode = 400;
        var problemDetails = new ValidationProblemDetails
        {
            Title = "Validation Failed",
            Status = 400,
        };
        foreach (var error in ex.Errors)
        {
            problemDetails.Errors.TryAdd(error.PropertyName, [error.ErrorMessage]);
        }
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
    catch (IdentityValidationException ex)
    {
        context.Response.StatusCode = 400;
        var problemDetails = new ProblemDetails
        {
            Title = "Identity Validation Failed",
            Status = 400,
            Detail = string.Join("; ", ex.Errors)
        };
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
});
```

**Why this matters:** This is a catch-all for the two known exception types that bubble up from the MediatR pipeline and identity services. It converts them to RFC 7807 `ProblemDetails` responses — the standard error format for HTTP APIs. Unhandled exceptions fall through to ASP.NET Core's default 500 handler.

### 4. OpenIddict Server Configuration — OIDC Endpoints

The identity server setup with PKCE enforcement:

```csharp
// apps/portal-api/Program.cs (lines 96-141)
builder.Services.AddOpenIddict()
    .AddCore(options => options.UseEntityFrameworkCore().UseDbContext<PortalDbContext>())
    .AddServer(options => {
        // Endpoints
        options.SetAuthorizationEndpointUris("connect/authorize")
               .SetLogoutEndpointUris("connect/logout")
               .SetTokenEndpointUris("connect/token")
               .SetUserInfoEndpointUris("connect/userinfo");

        // Flows — Authorization Code + Refresh, PKCE required
        options.AllowAuthorizationCodeFlow()
               .AllowRefreshTokenFlow()
               .RequireProofKeyForCodeExchange();  // PKCE mandatory

        // Scopes
        options.RegisterScopes(Scopes.Email, Scopes.Profile, Scopes.Roles, Scopes.OpenId);

        // Crypto — dev certificates (production: Azure Key Vault or ACME)
        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        // Integration
        options.UseAspNetCore()
               .EnableAuthorizationEndpointPassthrough()
               .EnableLogoutEndpointPassthrough()
               .EnableTokenEndpointPassthrough()
               .EnableUserInfoEndpointPassthrough();
    })
    .AddValidation(options => {
        options.UseLocalServer();  // Validate tokens locally (no JWKS fetch)
        options.UseAspNetCore();
    });
```

**Why this matters:** `RequireProofKeyForCodeExchange()` enforces PKCE for all clients — the Implicit Flow is not available. `UseLocalServer()` means the API validates tokens against its own signing keys (no network call to a JWKS endpoint), reducing latency. The `ClientType = Public` in seed data means no client secret — PKCE is the sole proof mechanism.

### 5. Service Registration — Dependency Injection Map

The complete DI wiring:

```csharp
// apps/portal-api/Program.cs (lines 43-61)
builder.Services.AddHttpContextAccessor();              // Ambient HTTP context
builder.Services.AddMemoryCache();                      // IMemoryCache for tenant + OTP + privilege cache
builder.Services.AddScoped<ITenantService, TenantService>();           // Per-request tenant state
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>(); // Per-request user identity
builder.Services.AddScoped<IIdentityService, IdentityService>();       // UserManager wrapper
builder.Services.AddScoped<IPrivilegeService, PrivilegeService>();     // Privilege CRUD
builder.Services.AddScoped<IOtpService, OtpService>();                 // OTP generation/validation
builder.Services.AddScoped<IMessageBus, LoggingMessageBus>();          // Stub — logs only
builder.Services.AddSingleton<IRealTimeNotifier, SignalRRealTimeNotifier>(); // Singleton (IHubContext is safe)
builder.Services.AddSignalR();                                         // SignalR services
builder.Services.AddSingleton<IRealTimeNotifier, SignalRRealTimeNotifier>(); // SignalR push
```

**Why this matters:** All business services are `Scoped` (one per request), matching the `PortalDbContext` lifetime. `IRealTimeNotifier` is `Singleton` because `IHubContext<NotificationHub>` is inherently thread-safe. `IMessageBus` is a stub — in production, it would be replaced with MassTransit or Azure Service Bus.

---

## Architecture Decision Record

Key trade-offs made in `tai-portal` and why:

| Decision | Choice | Alternative | Why |
|----------|--------|-------------|-----|
| Identity provider | OpenIddict (self-hosted) | Auth0, Okta | Data sovereignty — no PII leaves our infrastructure |
| Database | PostgreSQL (single shared) | SQL Server, per-tenant DBs | Cost, operational simplicity for POC; `xmin` for concurrency |
| API Gateway | YARP (in-process) | Nginx, Envoy, Kong | Native .NET integration, code-level transforms, no sidecar |
| State management | MediatR CQRS | Direct service calls | Validation pipeline, clean controller layer, testable handlers |
| Real-time | SignalR (single hub) | gRPC streaming, WebSocket | Built-in Angular support, groups for tenant isolation |
| Event dispatch | In-process (SaveChangesAsync) | Outbox + message broker | Simplicity for POC; Outbox planned for production |
| Concurrency | Optimistic (xmin) | Pessimistic (row locks) | Lock-free reads, web-scale friendly |
| Monorepo | Nx | Turborepo, Rush | Supports both .NET and Angular, affected-project testing |
| Message bus | Stub (LoggingMessageBus) | MassTransit + RabbitMQ | Not needed yet; interface ready for swap |

---

## Interview Q&A

### L2: REST vs Message Broker for Microservice Communication

**Answer:** REST creates synchronous coupling — if Service B is down, Service A's request fails. A message broker (RabbitMQ, Kafka, Azure Service Bus) decouples the services. Service A publishes an `OrderPlacedEvent` and completes immediately. Service B processes it asynchronously when ready.

In `tai-portal`, this pattern is partially implemented. Domain events are dispatched in-process via MediatR, and `IMessageBus` is a stub that logs messages. In production, `LoggingMessageBus` would be replaced with MassTransit backed by RabbitMQ or Azure Service Bus, enabling true async decoupling.

**When to use REST:** When you need a synchronous response (fetching user data to display in the UI). When the caller needs to know if the operation succeeded before proceeding.

**When to use messaging:** When the caller doesn't need an immediate response (sending a notification, updating a search index). When you need guaranteed delivery despite downstream failures.

### L2: What Is a Reverse Proxy Gateway and Why Use One?

**Answer:** A reverse proxy sits between clients and backend services, routing requests to the appropriate service. It centralizes cross-cutting concerns: TLS termination, rate limiting, authentication, CORS, and request transformation.

In `tai-portal`, YARP acts as the gateway on port 5217. It routes 6 route patterns to the API on port 5031, injects `X-Gateway-Secret` on every request (so the API can trust the caller), enables WebSocket proxying for SignalR, and applies token-bucket rate limiting to the OIDC token endpoint (`/connect/**`). No client can reach the API directly — the `GatewayTrustMiddleware` rejects requests without the secret.

### L3: How Does the Middleware Pipeline Order Affect Security?

**Answer:** Middleware order is a security-critical decision. In `tai-portal`:

1. **Exception handling** first — catches errors from all subsequent middleware
2. **CORS** before auth — preflight OPTIONS requests must be handled before authentication rejects them
3. **Gateway trust** before auth — validates `X-Gateway-Secret` to ensure the request came through the gateway, not directly to the API
4. **Authentication** before authorization — you must know who the user is before checking what they can do
5. **Tenant resolution** after auth — reads `tenant_id` claim from the authenticated user
6. **Endpoints** last — the actual request handling

**Misorder example:** If authentication ran before gateway trust, an attacker could call the API directly (bypassing the gateway's rate limiting) with a valid JWT and succeed — the gateway trust check would never run. The current order ensures gateway trust is verified before any auth processing.

### L3: Design a Multi-Tenant Architecture — Shared vs. Isolated

**Answer:** Three tiers of increasing isolation:

**Shared database, row-level filtering (tai-portal):**
- All tenants in one database, Global Query Filters enforce `TenantId`
- Pros: Single migration path, simple operations, cost-effective
- Cons: Noisy neighbor, single DB failure affects all tenants
- Use for: Standard SaaS tenants (95% of customers)

**Shared database, schema-per-tenant:**
- Each tenant gets its own PostgreSQL schema (`tenant_123.Users`)
- Pros: Logical isolation, per-tenant backup/restore
- Cons: N schemas to migrate, connection pool challenges
- Use for: Regulated tenants needing logical separation

**Database-per-tenant:**
- Each tenant gets their own database (or dedicated server)
- Pros: Complete isolation, independent scaling, per-tenant encryption
- Cons: N databases to manage, cross-tenant queries require federation
- Use for: Enterprise contracts requiring physical separation

**tai-portal's approach:** Shared database with three enforcement layers — middleware (host → tenant), EF Core (query filters + interceptor), SignalR (group isolation). The `IsGlobalAccess` flag in `ITenantService` allows admin operations to bypass filters.

---

## Cross-References

- **[[MediatR-CQRS]]** — CQRS pipeline, commands/queries, validation behavior, domain event dispatch — the full request handling pipeline
- **[[DDD-Domain-Modeling]]** — Rich domain model, entities, value objects, state machines, domain events — the domain layer this architecture hosts
- **[[Distributed-Systems]]** — Circuit breaker, retry, saga, outbox — resilience patterns for production evolution
- **[[Design-Patterns]]** — Micro-architecture patterns (Strategy, Observer, Mediator) that compose into the system-level patterns described here
- **[[EFCore-SQL]]** — Global Query Filters, SaveChangesAsync override, TenantInterceptor, xmin concurrency — database layer implementation
- **[[Authentication-Authorization]]** — OpenIddict configuration, OIDC flows, DPoP, claims-based authorization policies
- **[[Security-CSP-DPoP]]** — Gateway trust middleware, CORS, rate limiting, CSP headers — the security layer of the gateway
- **[[SignalR-Realtime]]** — NotificationHub, Claim Check pattern, BFF auth, NgZone optimization — the real-time layer
- **[[Logging-Observability]]** — Structured logging, distributed tracing, metrics — the observability layer
- **[[Angular-Core]]** — Frontend architecture: standalone components, signal stores, functional guards/interceptors
- **[[RxJS-Signals]]** — Frontend reactive architecture: signal-based stores that consume the CQRS API responses
- **[[OpenSearch]]** — Full-text search architecture, inverted indices, sharding — the search layer

---

## Further Reading

- [YARP Documentation](https://microsoft.github.io/reverse-proxy/)
- [Microservices Patterns by Chris Richardson](https://microservices.io/patterns/index.html)
- [Microsoft: Multi-tenant SaaS patterns](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [OpenIddict Documentation](https://documentation.openiddict.com/)

---

*Last updated: 2026-04-10*
