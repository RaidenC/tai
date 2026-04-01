---
title: System Design & Architecture
difficulty: L2 | L3 | Staff
lastUpdated: 2026-03-31
relatedTopics:
  - Design-Patterns
  - Data-Structures-Algorithms
  - SignalR-Realtime
---

## TL;DR

In 2026, System Design for senior engineers has moved beyond basic load balancing and monolithic SQL scaling. The focus is now on **distributed resilience** (handling failures across microservices), **AI-native integration** (putting agents in the critical request path), and **modern data strategies** (event streaming, decoupled data ownership). An effective architecture must balance performance, consistency, and the sheer cost of execution (FinOps).

## Deep Dive

### Concept Overview

#### 1. Distributed Resilience Patterns
When your system spans multiple microservices, failure is guaranteed. You must design for it.
*   **The Outbox Pattern:** Guarantees that a database update and a message queue publish happen atomically without requiring slow, locking Distributed Transactions (2PC). You save the message to an "Outbox" table in the exact same SQL transaction as your business data. A background worker then polls the Outbox and pushes the message to the queue (e.g., RabbitMQ).
*   **Saga Pattern:** A sequence of local transactions used to maintain data consistency across microservices. If Step 1 (Create Account) and Step 2 (Provision DB) succeed, but Step 3 (Charge Credit Card) fails, the Saga executes *compensating transactions* to undo Step 1 and Step 2.
*   **Circuit Breaker:** If an external downstream service (like a payment gateway or LLM provider) is timing out, the circuit breaker "trips" (opens) to stop sending requests, instantly returning a fallback error. This prevents your own server from exhausting its thread pool while waiting for the dead service.

#### 2. AI-Native Architecture
AI is no longer just a background cron job; it sits in the live request path.
*   **Orchestration vs. Inference:** System design must separate the *Orchestration Layer* (building prompts, vector DB retrieval, applying security guardrails) from the *Inference Layer* (the actual GPU calculating tokens). This allows you to hot-swap LLM providers (e.g., OpenAI vs. Anthropic) without rewriting your core business logic.
*   **Retrieval-Augmented Generation (RAG):** When an AI Agent needs private company data, it performs a semantic search against a Vector Database (using HNSW graphs), injects the most relevant context into the prompt, and streams the answer back to the user.

#### 3. Modern Data Strategy & Communication
*   **Event Streaming (Pub/Sub):** Moving away from point-to-point REST API calls between internal services. Instead, the producer publishes a "Fact" (e.g., `UserRegisteredEvent`) to a message broker (Kafka, Azure Service Bus). Consumers subscribe to facts they care about, completely decoupling the systems.
*   **gRPC / Protocol Buffers:** For synchronous internal (East-West) traffic, gRPC is the standard. It uses HTTP/2 and binary serialization (Protobuf), significantly reducing payload size and latency compared to text-based JSON/REST.

#### 4. Database Partitioning & Concurrency
As datasets grow into the millions (or billions) of rows, standard SQL tables become a massive bottleneck.
*   **Table Partitioning:** Splitting one massive table into smaller, physical chunks based on a "Partition Key" (like a Date or TenantId) while keeping it looking like a single table to the application. This enables **Partition Pruning**, where the database engine completely skips scanning years of old data if the query only asks for today's data.
*   **Sharding (Horizontal Partitioning):** Moving those partitions onto entirely different physical database servers to distribute the CPU/RAM load. 
*   **Optimistic Concurrency:** In highly concurrent systems, using database locks (Pessimistic Concurrency) destroys throughput. Instead, we use "Optimistic" concurrency via an ETag or RowVersion. You let two users edit the same record at the same time, but the database rejects the second save attempt if the underlying version has changed, preventing "Lost Updates" without locking the table.

### Real-World Example (from tai-portal)

#### 1. Event-Driven Architecture (The Outbox/Dispatcher)
In the **TAI Portal**, we utilize an event-driven architecture to decouple our synchronous, high-speed API from slow background processes (like sending emails or pushing SignalR notifications).

When a user registers, the API handles the domain logic, commits to the PostgreSQL database, and immediately returns a fast `200 OK`. As part of that process, a Domain Event is dispatched via MediatR and published to an `IMessageBus` (Service Bus). A separate background worker listens to the Service Bus to handle the actual notification delivery.

```csharp
// Example conceptual flow matching our Domain-Driven Design approach
public async Task Handle(RegisterUserCommand request, CancellationToken token) {
    // 1. Perform business logic
    var user = new ApplicationUser(request.Email);
    user.StartCustomerOnboarding();
    
    // 2. Add to EF Core Context
    _dbContext.Users.Add(user);
    
    // 3. The user entity contains Domain Events.
    // Our EF Core SaveChangesAsync override implements a rudimentary Outbox/Dispatcher 
    // by reading these events and pushing them to our Service Bus.
    await _dbContext.SaveChangesAsync(token); 
    
    // 4. API Returns immediately. The Service Bus background worker 
    // handles the UserRegisteredEvent to trigger SignalR alerts to Admins.
}
```

#### 2. Declarative Table Partitioning (PostgreSQL)
For our high-volume security Audit Logs, a single SQL table would quickly become unmanageable. We utilize **PostgreSQL Declarative Partitioning** to physically split the table by Date (`Timestamp`), while keeping it logically queryable as a single `AuditLogs` table via EF Core.

[View AddPartitionedAuditLogs.cs Migration](../../../libs/core/infrastructure/Persistence/Migrations/20260329223950_AddPartitionedAuditLogs.cs)

```sql
-- Conceptual raw SQL used in our EF Core Migration
CREATE TABLE "AuditLogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Timestamp" timestamp with time zone NOT NULL,
    "Action" text NOT NULL,
    PRIMARY KEY ("Id", "Timestamp") -- Partition Key MUST be part of the PK
) PARTITION BY RANGE ("Timestamp");

-- We then create physical partitions for each time period
CREATE TABLE "AuditLogs_2026_Q1" PARTITION OF "AuditLogs" 
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```
This allows us to maintain blazing-fast insert speeds and instantly drop old audit logs (`DROP TABLE "AuditLogs_2025_Q4"`) instead of running expensive `DELETE` queries that lock the database.

#### 3. Optimistic Concurrency (ETags & PostgreSQL `xmin`)
To prevent "Lost Updates" when multiple admins edit the same user simultaneously, we avoid slow database locks (Pessimistic Concurrency) and use **Optimistic Concurrency mapped to HTTP standards**.

PostgreSQL maintains a hidden system column (`xmin`) that increments on every update. We map this to a `RowVersion` property in EF Core.
1. Admin A fetches a user. The API returns `xmin` as an HTTP `ETag` header (e.g., `1001`).
2. Admin B fetches the same user, edits, and saves. The database `xmin` becomes `1002`.
3. Admin A submits their edit, sending `If-Match: "1001"`. 
4. EF Core generates: `UPDATE Users SET ... WHERE Id = 1 AND xmin = '1001'`. 
5. The `WHERE` clause finds 0 rows. The API catches the `DbUpdateConcurrencyException` and returns a `409 Conflict`, protecting the data without locking the table.

#### 4. Massive File Search (OpenSearch)
In the **DocViewer** project, standard SQL databases cannot handle searching through the textual content of millions of uploaded PDFs and Word documents. We offload this to **OpenSearch** (an Elasticsearch fork).
*   **Inverted Indices:** Instead of scanning rows like SQL, OpenSearch maps words directly to the document IDs that contain them.
*   **Sharding for Scale:** As the index grows beyond the storage capacity of a single server, OpenSearch automatically shards the index across a cluster of nodes. When a user searches, the coordinator node scatters the query to all relevant shards and gathers the results in milliseconds.

### Key Takeaways
- **Async by Default:** Never block a fast API request waiting for a slow external system (like SMTP or an LLM). Offload it to a queue.
- **Cost-Aware Design (FinOps):** AI inference is incredibly expensive. Cache heavily, use semantic caching where possible, and only hit the GPU when absolutely necessary.
- **Embrace Eventual Consistency:** In distributed systems, striving for perfect real-time Strong Consistency across different microservices creates massive bottlenecks. Design the UX to tolerate Eventual Consistency.

---

## Interview Q&A

### L2: Microservice Communication (REST vs Messages)
**Difficulty:** L2 (Mid-Level)

**Question:** Microservice A needs Microservice B to know that an order was placed. Should A call B's REST API, or should A publish a message to a Message Broker? Why?

**Answer:** A should publish a message (Event-Driven Architecture). If A calls B's REST API directly, they become tightly coupled. If B is offline or slow, A will fail or hang. By publishing an `OrderPlacedEvent` to a Message Broker (like RabbitMQ), A can complete its work instantly. B can then pull the message at its own pace whenever it is back online, ensuring high availability and system resilience.

---

### L3: The Outbox Pattern
**Difficulty:** L3 (Senior)

**Question:** You need to save a user to your PostgreSQL database and publish a `UserCreatedEvent` to Kafka. How do you guarantee both happen or neither happen, given that SQL and Kafka don't share a transaction coordinator?

**Answer:** I would use the **Transactional Outbox Pattern**. In the exact same SQL transaction where I insert the new user row, I also insert a JSON representation of the `UserCreatedEvent` into an `Outbox` SQL table. Because they share the same database transaction, it's guaranteed atomic. A separate background process (like Debezium or a custom worker) continuously polls the `Outbox` table, publishes the events to Kafka, and marks them as processed.

---

### L3: Graceful Degradation in AI Systems
**Difficulty:** L3 (Senior)

**Question:** Your application relies on an Agentic AI workflow in the critical request path to summarize data. The LLM provider (e.g., OpenAI) goes down. How do you architect the system to handle this gracefully?

**Answer:** First, I would use the **Circuit Breaker** pattern. After a threshold of failed LLM requests, the circuit trips to prevent our servers from exhausting threads waiting for timeouts. Second, I would decouple the *Orchestration* from the *Inference*. The orchestration layer would detect the tripped circuit and either fallback to a secondary, cheaper inference provider (e.g., a locally hosted model or Anthropic), or gracefully degrade the UI by bypassing the AI summary and returning raw data, accompanied by an informative message to the user.

---

### L3: Scaling SQL with Table Partitioning
**Difficulty:** L3 (Senior)

**Question:** In the `tai-portal`, our `AuditLogs` table is growing by 10 million rows a month. Deleting old logs takes hours and locks the database, and queries are getting slow. How do you re-architect the database to handle this massive scale?

**Answer:** I would implement **Declarative Table Partitioning** (specifically RANGE partitioning by `Timestamp`). This physically splits the massive table into smaller, monthly chunks (partitions) while keeping it logically queryable as a single table. This solves both problems: 
1. **Performance:** The database engine uses "Partition Pruning" to completely skip searching old months if the query only targets this week. 
2. **Maintenance:** Deleting a month of old logs becomes a lightning-fast $O(1)$ metadata operation (`DROP TABLE AuditLogs_Jan2025`) rather than a transaction-heavy `DELETE` statement.

---

### L3: Massive Full-Text Search (Elasticsearch/OpenSearch)
**Difficulty:** L3 (Senior)

**Question:** In the DocViewer project, we need to allow users to search for specific words across millions of multi-page PDF documents. Why can't we just use a PostgreSQL `LIKE '%word%'` query, and how does OpenSearch solve this?

**Answer:** A SQL `LIKE` query with a leading wildcard requires a full table scan. The database must physically read every single row on disk, which will timeout and crash the server on millions of documents. OpenSearch solves this using an **Inverted Index** (similar to the index at the back of a book). When a document is uploaded, OpenSearch tokenizes the text and maps every word directly to the Document IDs that contain it. A search for "contract" instantly looks up the word "contract" in the index and returns the IDs in $O(1)$ or $O(\log N)$ time, bypassing the need to scan the documents entirely.

---

### Staff: Distributed Transactions (Sagas)
**Difficulty:** Staff

**Question:** In a distributed e-commerce system, an "Order Placement" spans the Inventory Service, the Payment Service, and the Shipping Service. Describe how you would manage this transaction if the Payment succeeds but the Shipping Service throws a fatal error.

**Answer:** I would implement the **Saga Pattern**, specifically using an *Orchestrator* (a central state machine coordinating the flow) or *Choreography* (services reacting to events). If the Shipping Service fails, it emits a `ShippingFailedEvent`. The Saga Coordinator intercepts this and triggers **Compensating Transactions** in reverse order. It would send a command to the Payment Service to issue a refund, and a command to the Inventory Service to unlock the reserved stock. It achieves eventual consistency without using expensive distributed database locks.

---

## Cross-References
- [[Design-Patterns]] — Focuses on micro-architecture (code level) vs macro-architecture (system level).
- [[SignalR-Realtime]] — How background events are pushed from the Service Bus down to the user's browser.

---

## Further Reading
- [Microservices Patterns by Chris Richardson](https://microservices.io/patterns/index.html)
- [The Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Microsoft: Saga distributed transactions](https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/saga/saga)

---

*Last updated: 2026-03-31*