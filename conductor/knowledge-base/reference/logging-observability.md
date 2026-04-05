---
title: Logging & Observability
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-03
relatedTopics:
  - System-Design
  - EFCore-SQL
  - Message-Queues
  - SignalR-Realtime
  - Security-CSP-DPoP
---

## TL;DR

Modern .NET logging follows a three-layer pattern: **structured logging in code** (`ILogger<T>` + Serilog enrichers), a **transport/sink** (where logs land — Seq, OpenSearch, CloudWatch, Azure Monitor), and **visualization/alerting** (Grafana, OpenSearch Dashboards, CloudWatch Insights). The key insight is that **application logs and audit logs are different concerns** — application logs are ephemeral operational data (debugging, performance, errors), while audit logs are compliance records (who did what, when, with legal retention requirements). `tai-portal` already has audit logging right: `AuditEntry` entities in PostgreSQL with `CorrelationId`, `TenantId`, and time-based partitioning. What's missing is structured application logging (Serilog), centralized log aggregation (OpenSearch or a managed sink), and distributed tracing (OpenTelemetry) to connect requests across the gateway → API → SignalR pipeline. The code-level abstraction (`ILogger<T>`) stays the same regardless of where logs land — swapping from Seq (local dev) to CloudWatch (AWS) to Azure Monitor is a one-line sink configuration change.

## Deep Dive

### Concept Overview

#### 1. Structured vs Unstructured Logging — Why It Matters
- **What:** Structured logging captures log events as key-value pairs (properties), not flat strings. Instead of `$"User {userId} logged in from {ip}"` (a string that requires regex to parse), structured logging writes `LogInformation("User {UserId} logged in from {IpAddress}", userId, ip)` — producing a JSON object with `UserId` and `IpAddress` as queryable fields.
- **Why:** Unstructured logs (flat text lines) seem fine until you need to answer questions like "show me all failed logins for tenant acme in the last hour." With flat text, that's `grep` with fragile regex. With structured logs, it's a property query: `Level = "Error" AND TenantId = "acme" AND Action = "Login" AND Timestamp > now-1h`. Every centralized logging system (OpenSearch, Seq, CloudWatch Insights, Loki) is built to query structured data.
- **How:** In .NET, `ILogger<T>` already supports structured logging via message templates. The `{placeholder}` syntax is not string interpolation — it creates named properties:
  ```csharp
  // GOOD: Structured — creates queryable UserId and TenantId properties
  _logger.LogInformation("User {UserId} authenticated for tenant {TenantId}", userId, tenantId);

  // BAD: String interpolation — produces a flat string, properties are lost
  _logger.LogInformation($"User {userId} authenticated for tenant {tenantId}");
  ```
- **When:** Always. There is no scenario where unstructured logging is preferable in 2026. Even `Console.WriteLine` in a POC should be replaced with `ILogger` — it costs nothing and pays off the moment you need to diagnose a bug.
- **Trade-offs:** Structured logging produces larger payloads (JSON vs plain text). At extreme volume (>1M events/sec), serialization overhead matters. For `tai-portal`'s scale (hundreds to thousands of events/minute), this is negligible.

#### 2. The .NET Logging Stack — ILogger, Providers, and Serilog
- **What:** .NET has a three-layer logging architecture:
  1. **`ILogger<T>`** — the abstraction your code calls. Injected via DI. Part of `Microsoft.Extensions.Logging`.
  2. **Providers** — implementations that decide where log events go. Built-in providers: Console, Debug, EventLog. Third-party: Serilog, NLog, log4net.
  3. **Serilog** — the de facto standard for .NET structured logging in 2026. Replaces the built-in provider pipeline with its own sink-based architecture. Over 100 sinks available (Console, File, Seq, OpenSearch, CloudWatch, Application Insights, etc.).
- **Why Serilog over built-in providers:**
  - **Enrichers** — automatically attach `MachineName`, `ThreadId`, `CorrelationId`, `TenantId` to every log event without changing calling code
  - **Sinks** — write to multiple destinations simultaneously (Console + OpenSearch + File)
  - **Filtering** — per-sink log level filtering (Console gets `Information+`, OpenSearch gets `Debug+`)
  - **Compact JSON** — `CompactJsonFormatter` produces efficient JSON for log aggregation systems
  - **`Serilog.AspNetCore`** — replaces the noisy default ASP.NET Core request logging with a single structured event per request including status code, elapsed time, and route
- **How:**
  ```csharp
  // Program.cs — replace default logging with Serilog
  builder.Host.UseSerilog((context, config) => config
      .ReadFrom.Configuration(context.Configuration)  // appsettings.json control
      .Enrich.FromLogContext()                          // captures LogContext.PushProperty values
      .Enrich.WithProperty("ServiceName", "portal-api")
      .Enrich.WithMachineName()
      .WriteTo.Console(new CompactJsonFormatter())
      .WriteTo.OpenSearch("http://localhost:9200", "portal-logs-{0:yyyy.MM.dd}"));

  // Middleware to enrich every request with TenantId and CorrelationId
  app.Use(async (context, next) => {
      var tenantId = context.Items["TenantId"]?.ToString();
      var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault()
                          ?? Guid.NewGuid().ToString();
      using (LogContext.PushProperty("TenantId", tenantId))
      using (LogContext.PushProperty("CorrelationId", correlationId))
      {
          await next();
      }
  });
  ```
- **When:** Add Serilog from the start of any .NET project. The setup cost is 5 minutes; the debugging benefit is immediate.
- **Trade-offs:** Serilog replaces the built-in logging pipeline, which means you need to understand Serilog's configuration model (not just `appsettings.json`'s `Logging` section). However, `Serilog.Settings.Configuration` bridges this gap — you can configure Serilog entirely from `appsettings.json`.

#### 3. Log Levels — The Decision Tree
- **What:** Log levels indicate severity. .NET defines six levels (lowest to highest):
  | Level | When to Use | Example |
  |-------|------------|---------|
  | `Trace` | Step-by-step execution flow. Never in production. | "Entering ValidateToken with token hash {Hash}" |
  | `Debug` | Diagnostic details useful during development. | "Cache miss for tenant {TenantId}, querying database" |
  | `Information` | Normal operations worth recording. | "User {UserId} authenticated for tenant {TenantId}" |
  | `Warning` | Unexpected but handled situation. | "Rate limit approaching for IP {IpAddress}: {Count}/100" |
  | `Error` | Operation failed but the process continues. | "Failed to send SignalR notification: {Exception}" |
  | `Critical` | Application-wide failure, process may terminate. | "Database connection pool exhausted, no connections available" |
- **Why levels matter:** In production, you typically set the minimum level to `Information`. During debugging, drop to `Debug`. Per-namespace overrides let you dial up logging for specific subsystems without flooding the log:
  ```json
  {
    "Serilog": {
      "MinimumLevel": {
        "Default": "Information",
        "Override": {
          "Microsoft.AspNetCore": "Warning",
          "Tai.Portal.Core.Infrastructure.Persistence": "Debug"
        }
      }
    }
  }
  ```
- **The interview rule:** "If you're not sure, use `Information`. If it means a user's request failed, use `Error`. If you'd only care during debugging, use `Debug`. If the process might crash, use `Critical`."

#### 4. Centralized Log Aggregation — Where Logs Land
- **What:** Centralized logging collects logs from all services into one searchable store. Instead of SSH-ing into each container to read log files, you query a unified dashboard.
- **The landscape in 2026:**

  | Sink | Type | Best For | Cost Model |
  |------|------|----------|------------|
  | **Seq** | Self-hosted (.NET native) | Local dev, small teams, .NET-centric stacks | Free single-user, $X/user for teams |
  | **OpenSearch + Dashboards** | Self-hosted (open source) | Full-text search, shared with document search (DocViewer) | Infrastructure cost only |
  | **Loki + Grafana** | Self-hosted (open source) | Cost-efficient log aggregation, no full-text indexing | Infrastructure cost only |
  | **AWS CloudWatch Logs** | Managed (AWS) | AWS-deployed services, zero ops | $0.50/GB ingested + $0.03/GB stored |
  | **Azure Monitor / App Insights** | Managed (Azure) | Azure-deployed services, .NET first-class support | $2.30/GB ingested (first 5GB/month free) |
  | **Datadog** | SaaS | Full observability platform (logs + metrics + traces) | $0.10/GB ingested + per-host pricing |
  | **Elastic Cloud** | Managed Elasticsearch | Existing Elastic expertise | $95/month base |

- **How they relate to each other:**
  ```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        Your .NET Code                              │
  │  ILogger<T> calls → Serilog pipeline → Enrichers add context       │
  └────────────────────────────┬────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Serilog Sinks     │
                    │  (configuration     │
                    │   determines where) │
                    └──┬───┬───┬───┬──────┘
                       │   │   │   │
              ┌────────┘   │   │   └────────┐
              ▼            ▼   ▼            ▼
           Console      Seq  OpenSearch  CloudWatch
           (local)     (dev) (self-host) (AWS prod)
  ```
  The key: **your code never changes**. Only the sink configuration in `appsettings.json` differs per environment.

#### 5. AWS CloudWatch — The Managed Sink
- **What:** CloudWatch Logs is AWS's fully managed log aggregation service. Every AWS compute service (ECS, EKS, Lambda, EC2) can ship logs to CloudWatch automatically. For .NET, the `Serilog.Sinks.AwsCloudWatch` or `AWS.Logger.SeriLog` package writes directly.
- **Why:** Zero infrastructure management. No OpenSearch cluster to size, patch, or scale. CloudWatch automatically handles retention, replication, and scaling. Integrates natively with CloudWatch Alarms (alert when error rate spikes), CloudWatch Metrics (custom metrics from log patterns), and CloudWatch Insights (SQL-like query language).
- **How:**
  ```csharp
  // Serilog sink configuration for CloudWatch
  .WriteTo.AmazonCloudWatch(
      logGroup: "/tai-portal/api",
      logStreamPrefix: Environment.MachineName,
      region: RegionEndpoint.USEast1)
  ```
  CloudWatch Logs Insights query language:
  ```
  fields @timestamp, TenantId, UserId, @message
  | filter Level = "Error"
  | filter TenantId = "acme"
  | sort @timestamp desc
  | limit 50
  ```
- **When:** When deploying to AWS and you want zero-ops logging. Good enough for most teams. Consider adding OpenSearch (via Amazon OpenSearch Service) only when you need richer full-text search, complex aggregations, or visualization beyond what CloudWatch Dashboards offers.
- **Trade-offs:**
  - **Query limitations:** CloudWatch Insights is powerful but not as flexible as OpenSearch's query DSL. Complex aggregations (percentile latencies by tenant by endpoint) are cumbersome.
  - **Cost at scale:** $0.50/GB ingestion adds up. A chatty service logging 10GB/day costs $150/month just for ingestion. Solution: filter log levels aggressively (`Information` and above only in production) and use sampling for high-volume endpoints.
  - **Vendor lock-in:** CloudWatch API is AWS-specific. If you move to Azure, you're rewriting dashboards and alerts. But the application code stays the same (just swap the Serilog sink).
  - **Common AWS pattern:** CloudWatch Logs → CloudWatch subscription filter → Amazon OpenSearch Service. CloudWatch captures everything cheaply; a subscription filter streams specific log groups to OpenSearch for deeper analysis. This gives you the best of both worlds.

#### 6. OpenSearch for Logging — Dual-Use with Document Search
- **What:** OpenSearch (the AWS-backed fork of Elasticsearch) stores and indexes semi-structured data — making it ideal for both document search (DocViewer) and log aggregation. A single OpenSearch cluster can serve both use cases via separate indices.
- **Why for tai-portal specifically:** The DocViewer POC already runs OpenSearch in Docker (`docviewer-opensearch` on port 9200). Adding log indices to the same cluster requires zero new infrastructure for local development. In production, Amazon OpenSearch Service provides a managed cluster.
- **How:**
  ```
  OpenSearch Cluster (single Docker container for local dev)
  ├── Index: "documents-*"       ← DocViewer document content
  ├── Index: "portal-logs-*"     ← tai-portal application logs (daily rolling)
  └── Index: "gateway-logs-*"    ← YARP gateway access logs (daily rolling)
  ```
  Serilog writes via `Serilog.Sinks.OpenSearch`:
  ```csharp
  .WriteTo.OpenSearch(new OpenSearchSinkOptions(new Uri("http://localhost:9200"))
  {
      IndexFormat = "portal-logs-{0:yyyy.MM.dd}",
      AutoRegisterTemplate = true,
      AutoRegisterTemplateVersion = AutoRegisterTemplateVersion.OSv2,
      BatchPostingLimit = 50,
      Period = TimeSpan.FromSeconds(2)
  })
  ```
  OpenSearch Dashboards (port 5601) provides a unified UI to query both document content and application logs.
- **When:** When you're already running OpenSearch (DocViewer) and want one fewer system to manage. Also when you need full-text search across logs (e.g., searching exception stack traces, finding all logs mentioning a specific document ID across both systems).
- **Trade-offs:**
  - **Resource sharing:** In local dev, fine. In production, log ingestion bursts can impact document search latency if they share the same cluster. Solution: separate node pools (hot/warm architecture) or separate clusters.
  - **Index lifecycle management:** Log indices grow unboundedly. Configure ILM (Index Lifecycle Management) policies to roll over daily, transition to warm storage after 7 days, and delete after 30 days. Document indices have different lifecycle needs.
  - **Does NOT complicate DocViewer:** Indices are completely isolated. Different index patterns, different retention policies, different Dashboards views. The only shared resource is the OpenSearch process and its JVM heap.

#### 7. Application Logging vs Audit Logging — Different Concerns, Different Stores
- **What:** Application logs and audit logs serve fundamentally different purposes and should be treated differently:

  | Dimension | Application Logs | Audit Logs |
  |-----------|-----------------|------------|
  | **Purpose** | Debugging, performance monitoring, error tracking | Compliance, security forensics, legal evidence |
  | **Audience** | Developers, SRE/DevOps | Compliance officers, security team, auditors |
  | **Retention** | Days to weeks (30 days typical) | Months to years (regulatory requirement) |
  | **Mutability** | Can be deleted, filtered, sampled | Must be append-only, tamper-evident |
  | **Schema** | Semi-structured (JSON with varying fields) | Structured (fixed schema, typed columns) |
  | **Store** | OpenSearch, CloudWatch, Loki (optimized for search) | PostgreSQL, immutable append-only tables (optimized for integrity) |
  | **Query pattern** | Full-text search, aggregations, dashboards | Point queries by user/tenant/time, compliance reports |
  | **Example** | "Cache miss for tenant acme, query took 340ms" | "Admin user-123 revoked privilege view_reports for user-456" |

- **Why this matters for tai-portal:** The audit logging is already correct — `AuditEntry` entities in PostgreSQL with `CorrelationId`, `TenantId`, time-based partitioning, and domain event-driven writes. This must NOT move to OpenSearch or CloudWatch — it's compliance data that requires transactional integrity and immutability. Application logging is what's missing and what should go to a centralized log aggregation system.
- **How they connect:** The `CorrelationId` bridges both systems. When investigating a security incident, you query the audit log for the specific action, then use the same `CorrelationId` to find all application logs surrounding that request — cache misses, external API calls, timing data, error details. This is the "why" behind tai-portal's existing `X-Correlation-ID` header propagation.

#### 8. The Three Pillars of Observability — Logs, Metrics, Traces
- **What:** Observability is the ability to understand a system's internal state from its external outputs. The three pillars are:
  1. **Logs** — discrete events with context ("User login failed: invalid password")
  2. **Metrics** — numeric measurements over time (request rate, error rate, p99 latency)
  3. **Traces** — end-to-end request paths across services (gateway → API → database → SignalR)
- **Why all three:** Each pillar answers a different question:
  - **Metrics** tell you *something is wrong* (error rate spiked to 5%)
  - **Traces** tell you *where it's wrong* (the PostgreSQL query in the GetUsers handler is timing out)
  - **Logs** tell you *why it's wrong* (the query filter is missing a tenant index, causing a full table scan)
- **How (OpenTelemetry):** OpenTelemetry (OTel) is the CNCF standard for instrumenting applications. .NET 10 has first-class support:
  ```csharp
  builder.Services.AddOpenTelemetry()
      .WithTracing(tracing => tracing
          .AddAspNetCoreInstrumentation()
          .AddHttpClientInstrumentation()
          .AddNpgsql()                        // EF Core / PostgreSQL traces
          .AddOtlpExporter())                 // send to OTel Collector
      .WithMetrics(metrics => metrics
          .AddAspNetCoreInstrumentation()
          .AddRuntimeInstrumentation()
          .AddOtlpExporter());
  ```
  The OTel Collector routes telemetry to backends: traces → Tempo/Jaeger, metrics → Prometheus, logs → Loki/OpenSearch.
- **When:** Add metrics and tracing when you have more than one service (tai-portal already has gateway + API). The correlation between a slow gateway response and a slow database query is invisible without distributed tracing.
- **How traces connect to correlation IDs:** OpenTelemetry's `TraceId` serves the same purpose as tai-portal's `CorrelationId` — it follows a request across service boundaries. In production, you'd replace the custom `X-Correlation-ID` header with OTel's W3C `traceparent` header, and the correlation flows automatically through the gateway → API → database → SignalR pipeline.

#### 9. Kafka's Role in Logging — Transport, Not Storage
- **What:** Kafka is sometimes used as a **log transport layer** between producers and sinks, not as a logging system itself. The pattern: services write logs to a Kafka topic, and downstream consumers route logs to OpenSearch, S3, or a data lake.
- **Why Kafka for log transport:**
  - **Backpressure handling:** If OpenSearch is temporarily down, Kafka buffers logs (7-day retention by default). Without Kafka, logs are lost during sink outages.
  - **Fan-out:** The same log stream goes to OpenSearch (for search), S3 (for cold storage/compliance), and a fraud detection pipeline (for real-time analysis). Each consumer reads independently.
  - **Decoupling:** Services don't need to know where logs end up. They write to Kafka; consumers decide the destination.
- **When Kafka makes sense for logs:** At scale (>50 services, >100K log events/second) or when you need multi-destination fan-out. Companies like LinkedIn, Netflix, and Uber use Kafka as their central log bus.
- **When Kafka does NOT make sense for logs:** Small to medium systems (<20 services). Direct Serilog → OpenSearch writes handle thousands of events/second without backpressure issues. If you need a lightweight log router, **Fluent Bit** or the **OpenTelemetry Collector** serves the same buffering/routing purpose without Kafka's operational overhead (ZooKeeper/KRaft, partition management, consumer group rebalancing).
- **For tai-portal:** Kafka is overkill. Two backend services producing hundreds to low thousands of events per minute. Serilog writes directly to the sink. If you later need buffering, the OpenTelemetry Collector provides batch exporting with retry — no Kafka required.

#### 10. Frontend Logging — Closing the Loop
- **What:** Frontend errors (Angular runtime exceptions, failed HTTP requests, CSP violations) need to reach the same centralized logging system as backend logs to give a complete picture.
- **How:**
  1. **Angular `ErrorHandler`** — global error handler catches unhandled exceptions, sends them to a backend `/api/logs` endpoint with the current `CorrelationId` (from the request that loaded the page or the SignalR connection).
  2. **HTTP Interceptor** — logs failed API calls with status code, URL, and correlation ID.
  3. **CSP `report-uri`** — Content Security Policy violations are reported to a backend endpoint, logged with the page URL and violated directive.
  4. **Source maps** — production Angular bundles are minified. Upload source maps to your logging service so stack traces show original TypeScript file names and line numbers, not `main.abc123.js:1:45678`.
- **When:** From the start. Frontend errors are often the first symptom users see, but without centralized logging, they're invisible to the development team.

#### 11. Federation & External Apps — Log Boundaries
- **What:** When `tai-portal` federates with external apps from banks, log handling requires special care at the trust boundary.
- **Key principles:**
  - **Never log PII from external systems.** A bank's user data in your logs creates compliance liability. Redact or hash sensitive fields before logging.
  - **Correlation ID propagation.** Generate a correlation ID at the gateway and pass it to the federated app via header. The external app returns it in responses. This links your internal logs to the external interaction without sharing internal state.
  - **Log the contract, not the payload.** Log that a request was sent to `bank-x/api/accounts` with status `200` in `340ms`. Do NOT log the request/response body (which may contain account numbers, SSNs, etc.).
  - **Separate log indices.** Federation logs should be in a separate index (`federation-logs-*`) with different retention policies and access controls than internal application logs.
  - **Audit federation events.** Every federated auth flow (token exchange, consent grant, scope request) should produce an `AuditEntry` in PostgreSQL — these are compliance-relevant events.

---

## Real-World Code Examples

### 1. Existing Correlation ID Flow — Already in tai-portal

The foundation for observability is already built. `CorrelationId` flows from HTTP header → service → domain event → audit entry:

```csharp
// libs/core/application/Interfaces/ICurrentUserService.cs
public interface ICurrentUserService {
    string? CorrelationId { get; }
}

// libs/core/infrastructure/Services/CurrentUserService.cs
public string? CorrelationId =>
    _httpContextAccessor.HttpContext?.Request?.Headers["X-Correlation-ID"].ToString();

// libs/core/domain/Entities/AuditEntry.cs
public class AuditEntry {
    public string? CorrelationId { get; init; }
    // ... Timestamp, Action, UserId, TenantId, IpAddress, Details
}
```

Every event handler (e.g., `LoginAnomalyEventHandler`, `PrivilegeChangeEventHandler`) passes `CorrelationId` through to the audit entry, creating an end-to-end trace from the original HTTP request to the compliance record.

### 2. The LoggingMessageBus — What Needs Serilog

The current POC implementation uses `ILogger<T>` correctly but only writes to console:

```csharp
// libs/core/infrastructure/Services/LoggingMessageBus.cs
public class LoggingMessageBus : IMessageBus {
    private readonly ILogger<LoggingMessageBus> _logger;

    public Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) {
        var typeName = typeof(T).Name;
        _logger.LogInformation("[MESSAGE BUS] Publishing event {EventName}: {Payload}",
            typeName, JsonSerializer.Serialize(message));
        return Task.CompletedTask;
    }
}
```

This already uses structured logging syntax (`{EventName}`, `{Payload}`). Adding Serilog doesn't change this code — it changes where the output goes (from Console to OpenSearch/Seq/CloudWatch).

### 3. Audit Log Partitioning — The Right Pattern for Compliance Data

PostgreSQL time-based partitioning keeps audit queries fast as the table grows:

```sql
-- From migration 20260329223950_AddPartitionedAuditLogs
CREATE TABLE "AuditLogs" (
    "Id" uuid NOT NULL,
    "Timestamp" timestamptz NOT NULL,
    "Action" text NOT NULL,
    "UserId" text,
    "TenantId" text,
    "CorrelationId" text,
    "IpAddress" text,
    "Details" text
) PARTITION BY RANGE ("Timestamp");
```

This stays in PostgreSQL — it's compliance data, not operational logs. Application logs (debug output, request timing, cache misses) go to OpenSearch/CloudWatch.

---

## Interview Q&A

### L1: What Is Structured Logging and Why Is It Better Than String Concatenation?
**Difficulty:** L1 (Junior)

**Question:** Your team is writing logs like `Console.WriteLine($"User {userId} failed login")`. What's wrong with this approach?

**Answer:** String interpolation produces a flat text string that can only be searched with regex. Structured logging (e.g., `_logger.LogWarning("User {UserId} failed login", userId)`) preserves `UserId` as a queryable property. In a centralized logging system, you can filter `WHERE UserId = "abc-123"` instantly instead of parsing millions of text lines. It also enables aggregation — "show me the top 10 users with failed logins today" is a simple group-by on the `UserId` property, impossible with flat text.

---

### L1: What Are the Six Log Levels in .NET and When Do You Use Each?
**Difficulty:** L1 (Junior)

**Question:** Walk me through the .NET log levels and give an example of when to use each.

**Answer:** From lowest to highest: **Trace** (step-by-step execution, dev only), **Debug** (diagnostic detail like cache misses), **Information** (normal operations worth recording like successful authentication), **Warning** (unexpected but handled — rate limit approaching), **Error** (operation failed but process continues — failed to send notification), **Critical** (application-wide failure — database connection pool exhausted). In production, the minimum level is typically `Information`. The rule of thumb: if it means a user's request failed, it's `Error`. If you'd only care while debugging, it's `Debug`.

---

### L2: Your Previous Company Stored All Logs in a SQL Table. What's Wrong With That Approach?
**Difficulty:** L2 (Mid-Level)

**Question:** An architect proposes writing all application logs to a PostgreSQL table with columns for timestamp, level, message, and properties (JSONB). Evaluate this design.

**Answer:** It works at small scale but has fundamental problems:

1. **Write amplification** — Every `log.Info()` is a transactional INSERT competing with business queries for connection pool slots, WAL bandwidth, and I/O. At 1,000 log events/second, that's 1,000 additional transactions per second on your business database.
2. **Indexing cost** — To make logs queryable, you need indexes on timestamp, level, tenant_id, etc. Every INSERT updates every index. Full-text search on the message column requires a GIN index that's expensive to maintain.
3. **Retention management** — Deleting old logs from a hot table requires `DELETE` or partition drops. Without partitioning, `DELETE FROM logs WHERE timestamp < '30 days ago'` locks rows and bloats the table (dead tuples require VACUUM). With partitioning (like tai-portal's audit logs), it's manageable but still adds load.
4. **No full-text search** — `WHERE message LIKE '%timeout%'` can't use indexes. PostgreSQL's `tsvector` full-text search works but is far less capable than OpenSearch's inverted index with analyzers, tokenizers, and relevance scoring.

**The right split:** Keep audit logs in PostgreSQL (transactional integrity, compliance). Move application logs to a purpose-built store (OpenSearch, CloudWatch, Loki) designed for high-volume append-only writes with full-text search.

---

### L2: Explain the Difference Between Application Logs and Audit Logs. Can They Share a Store?
**Difficulty:** L2 (Mid-Level)

**Question:** Your team wants to put audit logs in OpenSearch alongside application logs. What concerns would you raise?

**Answer:** Audit logs have different requirements than application logs: they're compliance records that may need to be tamper-evident, have legally mandated retention periods (years, not days), and must guarantee write durability (a missed audit entry is a compliance violation). Application logs are ephemeral — losing a debug message is annoying, not illegal.

Putting audit logs in OpenSearch risks: (1) accidental deletion via index lifecycle management policies designed for application logs, (2) data loss during OpenSearch cluster recovery (OpenSearch is not ACID-compliant), and (3) compliance concerns — auditors may require audit data in a transactional database with provable write-ahead logging.

In tai-portal, audit logs are correctly stored in PostgreSQL with time-based partitioning. They share the `CorrelationId` with application logs so you can cross-reference: find the audit entry in PostgreSQL, then search OpenSearch for the same `CorrelationId` to see the full operational context.

---

### L3: Design the Logging Architecture for a Multi-Service System Deployed to AWS
**Difficulty:** L3 (Senior)

**Question:** You're deploying tai-portal (gateway + API) to AWS ECS. Design the logging architecture, covering local development, staging, and production.

**Answer:**

**Code layer (same across all environments):**
- Serilog with `ILogger<T>` abstraction. Enrichers for `TenantId`, `CorrelationId`, `ServiceName`, `Environment`.
- `Serilog.AspNetCore` replaces default request logging with one structured event per request.
- No `Console.WriteLine` anywhere — everything through `ILogger`.

**Local development:**
- Serilog → OpenSearch (shared with DocViewer POC, separate `portal-logs-*` index)
- OpenSearch Dashboards for ad-hoc queries
- Console sink with `CompactJsonFormatter` for terminal output

**Staging (AWS):**
- ECS task logs → CloudWatch Logs (automatic via awslogs driver, zero code)
- Serilog → CloudWatch Logs (same destination, richer structure)
- CloudWatch Alarms for error rate thresholds
- X-Ray or OTel for distributed tracing across gateway → API

**Production (AWS):**
- Same as staging, plus:
- CloudWatch subscription filter → Amazon OpenSearch Service for rich querying
- S3 export for long-term log archival (cheaper than CloudWatch storage)
- CloudWatch Insights for operational dashboards
- OpenTelemetry Collector as a sidecar for metrics and traces → Prometheus/Grafana or CloudWatch Metrics

**The key insight:** The application code doesn't change between environments. The Serilog sink configuration in `appsettings.{Environment}.json` controls where logs go:
```json
// appsettings.Development.json
{ "Serilog": { "WriteTo": [{ "Name": "OpenSearch", "Args": { "nodeUris": "http://localhost:9200" } }] } }

// appsettings.Production.json
{ "Serilog": { "WriteTo": [{ "Name": "AmazonCloudWatch", "Args": { "logGroup": "/tai-portal/api" } }] } }
```

---

### L3: How Do You Handle Logging Across Federation Boundaries With External Bank Apps?
**Difficulty:** L3 (Senior)

**Question:** tai-portal federates with external banking applications. How do you handle logging at the trust boundary?

**Answer:** Four principles:

1. **Correlation without exposure.** Generate a public correlation ID at the gateway and pass it to the external app via `X-Correlation-ID` header. The external app includes it in responses. This links your logs to the interaction without exposing internal trace IDs, user IDs, or tenant structure.

2. **Log the envelope, not the letter.** Log HTTP method, URL, status code, latency, and correlation ID. Never log request/response bodies — they may contain account numbers, SSNs, or other regulated data. If you must log payloads for debugging, use a separate debug index with 24-hour retention and restricted access.

3. **Separate index with different ACL.** Federation logs go to `federation-logs-*` with access restricted to the integration team and security team. Internal application logs in `portal-logs-*` are accessible to all developers. This prevents accidental exposure of federation data in developer dashboards.

4. **Audit the contract.** Every token exchange, consent grant, and scope request produces an `AuditEntry` in PostgreSQL. This is compliance-critical — regulators may ask "when did bank X's app last access your API, and what scopes were granted?"

---

### Staff: Compare CloudWatch, OpenSearch, and Loki+Grafana for a Growing Startup on AWS
**Difficulty:** Staff

**Question:** Your startup is on AWS, growing from 3 to 30 services over the next year. You need to choose a logging platform. Walk me through the trade-offs.

**Answer:**

| Dimension | CloudWatch | OpenSearch (self-hosted or Amazon OS) | Loki + Grafana |
|-----------|------------|--------------------------------------|---------------|
| **Ops burden** | Zero (fully managed) | Moderate to high (cluster sizing, upgrades, sharding) | Low (stateless queriers, only index labels not content) |
| **Query power** | Good (Insights SQL-like) | Excellent (full-text, aggregations, DSL) | Good for labels, weak for full-text |
| **Cost at 100GB/day** | ~$1,500/mo (ingest) + storage | ~$500-1,000/mo (EC2/EBS for cluster) | ~$200-400/mo (S3 storage, minimal compute) |
| **Cost at 1TB/day** | ~$15,000/mo | ~$3,000-5,000/mo | ~$1,000-2,000/mo |
| **Full-text search** | Partial (Insights) | Native strength | Weak (grep-like, not indexed) |
| **Dashboards** | Basic | OpenSearch Dashboards (powerful) | Grafana (excellent) |
| **Lock-in** | High (AWS API) | Low (open source, portable) | Low (open source, portable) |
| **Integration** | Native AWS (ECS, Lambda, ALB) | Requires Fluent Bit/OTel Collector | Requires Promtail/OTel Collector |

**My recommendation by stage:**

- **3 services (now):** CloudWatch. Zero ops, native ECS integration, good enough queries. Focus engineering time on product, not infrastructure.
- **10 services (6 months):** CloudWatch + Grafana Cloud. Grafana can query CloudWatch as a data source, giving you better dashboards without migrating logs.
- **30 services (1 year):** Evaluate: if log volume exceeds $3K/month on CloudWatch, migrate to Loki + Grafana (cheapest) or Amazon OpenSearch Service (richest queries). Use the OpenTelemetry Collector as the routing layer — services send to OTel Collector, which forwards to whatever backend you've chosen. Changing backends becomes a Collector config change, not a code change.

**The meta-answer:** Start with the managed option (CloudWatch). It's more expensive per GB but cheaper in total cost when you factor in engineering time. Migrate to self-hosted when the bill forces you to, and by then you'll have enough volume data to right-size the cluster.

---

## Cross-References

- **[[System-Design]]** — The Staff Q&A on observability outlines the same Serilog + OpenTelemetry architecture; this note expands with sink comparisons, CloudWatch specifics, and the audit vs application log distinction
- **[[EFCore-SQL]]** — Audit log partitioning, `SaveChangesAsync` domain event dispatch, `CorrelationId` flow through entities
- **[[Message-Queues]]** — Kafka as log transport (Section 9 here), Outbox pattern for guaranteed event delivery, the `IMessageBus` stub
- **[[SignalR-Realtime]]** — Real-time notification delivery that becomes observable via correlation IDs and structured logging
- **[[Security-CSP-DPoP]]** — CSP `report-uri` as a frontend logging mechanism, security event logging at trust boundaries
- **[[OpenSearch]]** — Inverted index fundamentals that power log search, index lifecycle management for log retention

---

## Further Reading

- [Serilog Documentation](https://serilog.net/)
- [Serilog.AspNetCore — Request Logging](https://github.com/serilog/serilog-aspnetcore)
- [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/dotnet/)
- [AWS CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [OpenSearch Log Analytics](https://opensearch.org/docs/latest/observing-your-data/log-ingestion/)
- [Grafana Loki](https://grafana.com/oss/loki/)
- [Seq — Structured Logging Server](https://datalust.co/seq)
- [Structured Logging Best Practices in .NET](https://docs.microsoft.com/en-us/dotnet/core/extensions/logging)

---

*Last updated: 2026-04-03*
