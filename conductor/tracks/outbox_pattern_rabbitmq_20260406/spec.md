# Specification: Outbox Pattern & RabbitMQ Integration

## Objective
Decouple side-effects (like audit logging and emails) from the primary database transaction by replacing in-process MediatR domain event dispatching with the Transactional Outbox Pattern and RabbitMQ.

## Background
Currently, `tai-portal` dispatches domain events synchronously during `SaveChangesAsync`. This means any failure in a downstream event handler (like a third-party email API) causes the entire database transaction to roll back. To transition toward a Modular Monolith, we need asynchronous, guaranteed delivery of events.

## Requirements
1. **Outbox Schema:** Add an `OutboxMessages` table to the primary PostgreSQL database to store serialized events.
2. **EF Core Integration:** Modify `SaveChangesAsync` to serialize Domain Events and write them to the `OutboxMessages` table within the same transaction, rather than publishing them immediately via MediatR.
3. **Background Publisher Worker:** Implement a BackgroundService that polls the `OutboxMessages` table.
4. **RabbitMQ Integration:** The worker publishes unprocessed messages to RabbitMQ (e.g., using MassTransit or standard RabbitMQ client).
5. **Local Setup:** Add RabbitMQ to `docker-compose.yml` for local development.

## Out of Scope
- Migrating existing handlers to consume from RabbitMQ (this is the first step; moving handlers to separate modules happens in subsequent tracks).