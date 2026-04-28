# Logging & Observability — Mindmap

## 1. Structured vs Unstructured Logging
- **Unstructured**: Flat text strings, requires regex to parse
- **Structured**: Key-value pairs, queryable fields (JSON)
- **.NET syntax**: `{Placeholder}` creates named properties
  - Good: `_logger.LogInformation("User {UserId} logged in", userId)`
  - Bad: `_logger.LogInformation($"User {userId} logged in")`
- **Always use structured** — enables filtering, aggregation, dashboards
- Trade-off: Larger payloads (JSON vs text), negligible at low volume

---

## 2. .NET Logging Stack
### Three Layers:
1. **ILogger<T>** — abstraction your code calls (Microsoft.Extensions.Logging)
2. **Providers** — where logs go (Console, Debug, EventLog)
3. **Serilog** — standard for .NET structured logging

### Serilog Features:
- **Enrichers**: Attach TenantId, CorrelationId, MachineName automatically
- **Sinks**: Console, Seq, OpenSearch, CloudWatch (100+ sinks)
- **Filtering**: Per-sink log level control
- **CompactJsonFormatter**: Efficient JSON for log aggregation

---

## 3. Log Levels
| Level | When to Use | Example |
|-------|-------------|---------|
| Trace | Step-by-step, dev only | "Entering ValidateToken" |
| Debug | Diagnostic details | "Cache miss for tenant" |
| Information | Normal operations | "User authenticated" |
| Warning | Unexpected but handled | "Rate limit approaching" |
| Error | Operation failed | "Failed to send notification" |
| Critical | Process may terminate | "DB pool exhausted" |

- Production default: Information
- Per-namespace overrides in appsettings.json

---

## 4. Centralized Log Aggregation

| Sink | Type | Best For |
|------|------|----------|
| Seq | Self-hosted | .NET dev, small teams |
| OpenSearch + Dashboards | Self-hosted | Full-text search, DocViewer shared |
| Loki + Grafana | Self-hosted | Cost-efficient, no full-text |
| CloudWatch Logs | Managed (AWS) | AWS-deployed services |
| Azure Monitor | Managed (Azure) | Azure-deployed services |
| Datadog | SaaS | Full observability platform |

- **Key insight**: Code never changes, only sink configuration differs

---

## 5. AWS CloudWatch
- **What**: AWS fully managed log aggregation
- **Serilog sink**: `Serilog.Sinks.AwsCloudWatch`
- **Benefits**: Zero ops, auto-scaling, integrates with CloudWatch Alarms/Metrics
- **Trade-offs**:
  - Query limitations vs OpenSearch
  - Cost: $0.50/GB ingestion
  - Vendor lock-in
- **Pattern**: CloudWatch Logs → Subscription filter → OpenSearch for deep analysis

---

## 6. OpenSearch for Logging
- **Dual-use**: Document search (DocViewer) + log aggregation
- **Index pattern**: `portal-logs-{yyyy.MM.dd}`, `gateway-logs-*`
- **Serilog sink**: `Serilog.Sinks.OpenSearch`
- **Dashboards**: Unified UI for documents + logs
- **ILM**: Index Lifecycle Management for retention (rollover → warm → delete)
- **Does NOT complicate DocViewer**: Different indices, retention, views

---

## 7. Application vs Audit Logging

| Dimension | Application Logs | Audit Logs |
|-----------|-----------------|------------|
| Purpose | Debugging, performance | Compliance, forensics |
| Audience | Dev, SRE | Compliance, auditors |
| Retention | Days to weeks | Months to years |
| Mutability | Can be deleted | Append-only, tamper-evident |
| Schema | Semi-structured (JSON) | Structured (fixed columns) |
| Store | OpenSearch, CloudWatch | PostgreSQL (partitioned) |
| Example | "Cache miss, query took 340ms" | "Admin revoked privilege X for user Y" |

**Key**: CorrelationId bridges both systems

---

## 8. Three Pillars of Observability
1. **Logs** — discrete events with context
2. **Metrics** — numeric measurements over time (request rate, error rate, p99 latency)
3. **Traces** — end-to-end request paths across services

**OpenTelemetry (OTel)** — CNCF standard for .NET:
- Traces → Tempo/Jaeger
- Metrics → Prometheus
- Logs → Loki/OpenSearch

---

## 9. Kafka's Role in Logging
- **Transport layer**, not storage
- **When makes sense**: >50 services, >100K events/sec, multi-destination fan-out
- **When NOT**: <20 services, direct Serilog → sink handles volume
- **Alternatives**: Fluent Bit, OTel Collector (lighter weight)

---

## 10. Frontend Logging
- **Angular ErrorHandler**: Global exception handler → backend `/api/logs`
- **HTTP Interceptor**: Log failed API calls with CorrelationId
- **CSP report-uri**: Policy violation reporting
- **Source maps**: Map minified stack traces to TypeScript

---

## 11. Federation & External Apps
- **Never log PII** from external systems
- **Correlation ID propagation**: Generate at gateway, pass to external app
- **Log contract, not payload**: URL, status, latency — NOT request/response body
- **Separate indices**: `federation-logs-*` with different ACL and retention
- **Audit federation events**: Token exchange, consent grant → PostgreSQL AuditEntry

---

## 12. Real-World Examples

### Correlation ID Flow (Already exists):
- HTTP header → service → domain event → audit entry
- `ICurrentUserService.CorrelationId` reads `X-Correlation-ID` header

### Audit Log Partitioning (PostgreSQL):
- Time-based partitioning on Timestamp
- Compliance data → PostgreSQL (not OpenSearch)

### LoggingMessageBus (Needs Serilog):
- Uses structured logging: `{EventName}`, `{Payload}`
- Just needs Serilog sink config change

---

## 13. Interview Q&A Summary
- **L1**: Structured vs unstructured logging, Log levels
- **L2**: SQL table for logs problems, Application vs Audit log distinction
- **L3**: Multi-service AWS logging design, Federation boundary logging
- **Staff**: CloudWatch vs OpenSearch vs Loki trade-offs by company stage
