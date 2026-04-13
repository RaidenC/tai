# Plan: Extract Audit Module & Migrate to OpenSearch

## Phase 1: OpenSearch Infrastructure
- [ ] Add `opensearch-node` and `opensearch-dashboards` to the project `docker-compose.yml`.
- [ ] Verify local connectivity and ensure OpenSearch Dashboards is accessible.

## Phase 2: Define Integration Contracts
- [ ] Create a `Tai.Portal.IntegrationEvents` class library.
- [ ] Define the core `IntegrationEvent` records that correspond to system actions (e.g., `UserApprovedIntegrationEvent`, `LoginAnomalyIntegrationEvent`).

## Phase 3: Create the Audit Module
- [ ] Create `Tai.Portal.Modules.Audit` class library.
- [ ] Add NuGet packages for RabbitMQ/MassTransit and `OpenSearch.Client`.
- [ ] Implement the OpenSearch repository/client setup to manage connecting and indexing documents.

## Phase 4: Implement Event Consumers
- [ ] Create RabbitMQ Consumers in the Audit Module that subscribe to the relevant integration events.
- [ ] In the consumer logic, map the event to a flat, searchable JSON document and index it into OpenSearch.

## Phase 5: Wire Up & Cleanup
- [ ] Register the new Audit Module services and consumers in the main API `Program.cs`.
- [ ] Remove `AuditEntry` and its configuration from `PortalDbContext` in the Core infrastructure.
- [ ] Generate an EF Core migration to drop the `AuditLogs` table from PostgreSQL.
- [ ] Verify that an action in the UI (e.g., user login) correctly writes a log to OpenSearch and appears in Dashboards.