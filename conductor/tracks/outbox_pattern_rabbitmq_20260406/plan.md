# Plan: Implement Outbox Pattern & RabbitMQ

## Phase 1: Infrastructure Setup
- [ ] Add RabbitMQ to the project `docker-compose.yml`.
- [ ] Add necessary NuGet packages (e.g., MassTransit, RabbitMQ.Client) to the API project.

## Phase 2: The Outbox Entity
- [ ] Create `OutboxMessage` entity (`Id`, `Type`, `Payload`, `CreatedAt`, `ProcessedAt`, `Error`).
- [ ] Configure `OutboxMessage` in EF Core (JSONB column for Payload, partial index on `ProcessedAt IS NULL`).
- [ ] Generate and run the EF Core migration.

## Phase 3: Update DbContext Save Pipeline
- [ ] Modify `PortalDbContext.SaveChangesAsync()` to stop publishing via MediatR directly.
- [ ] Instead, serialize pending Domain Events to JSON and add them to `OutboxMessages` `DbSet` prior to `base.SaveChangesAsync()`.

## Phase 4: The Background Publisher
- [ ] Create an `OutboxPublisherBackgroundService` that runs on a timer.
- [ ] Implement robust polling using `SELECT ... FOR UPDATE SKIP LOCKED` (or similar concurrency control) to fetch unprocessed messages.
- [ ] Publish messages to RabbitMQ.
- [ ] Mark messages as processed upon successful publishing.

## Phase 5: Testing & Verification
- [ ] Write integration tests verifying that a domain event correctly saves to the Outbox table.
- [ ] Verify that the background worker successfully publishes the message to RabbitMQ and updates the `ProcessedAt` timestamp.