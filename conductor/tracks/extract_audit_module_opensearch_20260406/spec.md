# Specification: Extract Audit Module & Migrate to OpenSearch

## Objective
Extract the auditing capability from the core monolith into an isolated Modular Monolith component (`Tai.Portal.Modules.Audit`). Replace the current relational PostgreSQL `AuditLogs` table with OpenSearch for high-performance, time-series, full-text log aggregation.

## Background
Currently, `AuditEntry` records are stored in PostgreSQL within the same database context as primary transactional data. As the system scales, storing immutable, append-only logs in a relational database becomes a bottleneck. Extracting this to OpenSearch and physically decoupling the Audit Module demonstrates enterprise-grade Modular Monolith principles.

## Requirements
1. **Physical Isolation:** Create a new project `Tai.Portal.Modules.Audit` that references integration event contracts.
2. **OpenSearch Integration:** Introduce OpenSearch and OpenSearch Dashboards to the local `docker-compose.yml`.
3. **Consumer Implementation:** Create a RabbitMQ Consumer (or MassTransit Consumer) inside the new Audit Module that listens for `SecurityEvent` and `IntegrationEvent` messages.
4. **OpenSearch Indexing:** The consumer maps the integration events to flat Audit Document structures and indexes them directly into OpenSearch using the `OpenSearch.Client` library.
5. **Cleanup:** Deprecate and remove the old PostgreSQL `AuditLogs` table and related infrastructure code from `PortalDbContext`.

## Dependencies
- This track depends heavily on the successful implementation of the **Outbox Pattern & RabbitMQ** track, which ensures events are reliably published for the new Audit Module to consume.