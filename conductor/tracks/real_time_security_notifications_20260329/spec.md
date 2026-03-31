# Specification: Real-Time Security Notifications & Audit Dashboard

## Overview
This track is designed as an **Applied Learning Masterclass** on real-time event-driven architecture. The goal is to build a highly resilient, real-time event pipeline that tracks critical security events and pushes them to the frontend via SignalR.

## Architecture Context: Portal as Identity Provider
Portal serves as the Identity Provider (IdP) for the company. When security events occur, two communication channels are used:

| Channel | Target | Technology | Pattern |
|---------|--------|------------|---------|
| **Real-Time Push** | Current User (Browser) | SignalR | Synchronous, instant |
| **Cross-App Events** | Other Apps (DocViewer, HR) | IMessageBus (RabbitMQ/EventBridge) | Asynchronous, eventual consistency |

> **Interview Talking Point:** "SignalR pushes to the browser in real-time. IMessageBus publishes to RabbitMQ so other apps like DocViewer can react to events without Portal knowing about them."

## Core Learning Objectives
1. **Event-Driven Architecture (EDA):** Pub/Sub model implementation using MediatR.
2. **WebSocket Theory:** Managing stateful connections (SignalR) in a stateless API.
3. **Resiliency & Idempotency:** Handling connection drops, missed messages, and guaranteeing exactly-once processing on the frontend.
4. **Data Partitioning:** High-performance SQL strategies for append-only audit logs.

## Functional Requirements
1. **Event Tracking:** Intercept and track Login Anomalies, Privilege Changes, and Security Setting Changes via MediatR notifications.
2. **Real-Time Pipeline:**
   - Domain events trigger MediatR notifications
   - MediatR handlers push to SignalR Hub
   - **Privacy-First Payload:** Reference ID and timestamp only (Claim Check pattern).
3. **Cross-App Integration:**
   - Same MediatR handlers also publish to IMessageBus for other apps (DocViewer, HR System).
   - Abstraction allows swapping RabbitMQ for AWS EventBridge in production.
4. **Frontend Integration:**
   - Global SignalR connection using `@ngrx/signals` (SignalStore).
   - Fetch secure details via authorized BFF calls using the reference ID.
5. **Contextual Audit Dashboard:**
   - Virtualized data table within User/Tenant Management views.

## Quality & Assurance (SQA) Mandates
To ensure zero regressions and high reliability, the following testing strategies MUST be implemented:
1. **Contract Testing (The Payload):** The event payload structure must be defined via a shared TypeScript interface generated from the C# Domain Event to ensure the frontend never breaks due to a backend typo.
2. **Resiliency & Chaos Testing:**
   - **Frontend:** Must include Vitest tests that explicitly simulate a dropped SignalR connection (`WebSocket.close()`) and verify the automatic reconnection and "catch-up" fetch logic.
   - **Backend:** Must include tests verifying that MediatR handlers gracefully handle transient failures when pushing to SignalR or IMessageBus.
3. **E2E Steel Thread (Playwright):** A dedicated Playwright test must trigger a security event (e.g., a failed login via API) in one browser context and verify that a toast notification appears in a secondary, authenticated Admin browser context within 2000ms.
4. **Load & Concurrency Bounds:** The Data Partitioning strategy must be verified by an integration test that performs bulk inserts (e.g., 10,000 mock audit logs) to ensure the `SqlBulkCopy` or batching logic does not violate DB timeout constraints.

## Non-Functional Requirements
- **Distributed Tracing:** Every event MUST carry an `X-Correlation-ID`.
- **Knowledge Artifacts:** Every phase MUST result in a `Knowledge Note` detailing the theory and senior-level interview talking points.