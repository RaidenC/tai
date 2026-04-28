---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **RabbitMQ**

## **1. AMQP Fundamentals**

### **1.1 Protocol Landscape (0.9.1 vs 1.0)**
1. **AMQP 0.9.1** (2008) — broker-centric, exchange/queue/binding in protocol
   - What `RabbitMQ.Client`, `amqplib`, `pika` speak by default
   - Most production RabbitMQ code in 2026
2. **AMQP 1.0** (2011, ISO/IEC 19464:2014) — peer-to-peer, link-oriented
   - No exchanges in protocol — broker-side address conventions
   - Native Azure Service Bus, IBM MQ v9+, Artemis, Qpid
   - RabbitMQ 4.0 (Sept 2024) made it first-class core protocol
3. Key differences
   - Conn → Session → Link (1.0) vs Conn → Channel (0.9.1)
   - Credit-based flow control (1.0) vs prefetch hack (0.9.1)
   - Disposition frames `accepted`/`rejected`/`released`/`modified` (1.0) vs binary ack/nack (0.9.1)
   - Standard message format with sections (1.0) vs properties bag (0.9.1)
4. Why 0.9.1 in greenfield projects (real history)
   - **GeoQ 2017** — RabbitMQ 3.6/3.7 + Node.js; 1.0 was experimental plugin only; `amqplib` 0.9.1-only; no real choice
   - **tai-portal 2025** — RabbitMQ 4.x supports 1.0, but .NET ecosystem (`RabbitMQ.Client`, MassTransit, EasyNetQ) is still 0.9.1-first; `AMQPNetLite` smaller community
   - Pattern: **client ecosystem maturity** decides, not protocol vintage
5. When to pick 1.0 anyway
   - Targeting Azure Service Bus (native 1.0 — fighting it loses features)
   - Cross-broker portability is a stated, funded requirement
   - Specific 1.0 feature pays off (credit-based flow control when `prefetch` has burned you)

### **1.2 Mental Model (Smart Broker)**
1. Smart broker, dumb consumer
   - Broker owns routing, retention, fan-out
   - Inverse of Kafka (dumb broker, smart consumer)
2. Five 0.9.1 entities: Connection, Channel, Exchange, Queue, Binding
3. AMQP 1.0 maps these to nodes + links via address conventions

### **1.3 Connection vs Channel (vs Session/Link)**
1. **0.9.1**: Connection (TCP + handshake, expensive) → Channel (cheap, per-thread)
2. **1.0**: Connection → Session (in-order context) → Link (one-way attachment, own credit window)
3. Pattern: one connection per process, channels/links per concurrent flow
4. Channels NOT thread-safe — one per thread (same in 1.0 with sessions)

### **1.3 Exchange Types**
1. **direct** — exact routing-key match
2. **fanout** — broadcast to every bound queue
3. **topic** — wildcard pattern matching (`*`=one word, `#`=zero+)
4. **headers** — match on header dict (rare)
5. Default exchange `""` — direct, queues bound by name

### **1.4 Queues**
1. Properties: `durable`, `exclusive`, `auto-delete`, `arguments`
2. Arguments: `x-message-ttl`, `x-max-length`, `x-dead-letter-exchange`, `x-queue-type`
3. Idempotent declare — but mismatched args throw `PRECONDITION_FAILED`
4. **Consumer owns queue declaration**, producer owns exchange

### **1.5 Routing Keys**
1. Topic exchange: dot-separated words, `*` and `#` wildcards
2. Convention: `<bounded-context>.<aggregate>.<event>`
3. Cap segments at 3-5 (avoid routing-key explosion)
4. tai-portal: `security.privilege-change`
5. GeoQ: `tracking.{tenant}.{assetType}.{event}`

## **2. Reliability**

### **2.1 Acknowledgments**
1. `basicAck` — done, delete
2. `basicNack(requeue=true)` — back to queue
3. `basicNack(requeue=false)` — to DLX (or drop)
4. Channel close without ack → broker requeues
5. Always ack AFTER side effect succeeds

### **2.2 Publisher Confirms**
1. `confirmSelect()` puts channel in confirm mode
2. **Sync**: `WaitForConfirmsOrDie` — simple, ~1k msg/s
3. **Async batch**: `BasicAcks`/`BasicNacks` events — 10-100×
4. `mandatory` flag + `basic.return` for "no queue bound"

### **2.3 Persistence (3 flags)**
1. Durable exchange — definition survives restart
2. Durable queue — definition survives restart
3. Persistent message (`delivery_mode=2`) — bytes on disk
4. ALL THREE required for guaranteed delivery
5. Cost: 5-10× write IOPS on classic queues

### **2.4 Dead-Letter & TTL**
1. DLX triggers: `nack(requeue=false)`, TTL expiry, queue length
2. TTL+DLX = exponential backoff for free
3. Pattern: work → retry-30s → retry-5m → permanent DLQ
4. `x-death` header tracks retry count
5. Always wire DLX for queues handling external input

### **2.5 Idempotency**
1. RabbitMQ is at-least-once end-to-end
2. Duplicates from: producer retry, consumer crash mid-work
3. Strategies: natural / dedup-table / version-check
4. `MessageId` AMQP property = canonical dedup key
5. Exactly-once is a consumer-side property, never broker-side

## **3. Consumer Patterns**

### **3.1 Competing Consumers (Work Queue)**
1. Many consumers on same queue, broker round-robins
2. Horizontal scaling via worker count
3. GeoQ: 12 enrichment workers × prefetch=4
4. No order across consumers (per-key needs partitioning)

### **3.2 Prefetch (QoS)**
1. `channel.prefetch(N)` = max unacked per consumer
2. Default = unlimited (DANGEROUS)
3. Tune: `prefetch ≈ p95_processing_ms / network_rtt_ms`
4. Too low → underutilized; too high → poor failover + unfairness

### **3.3 Pub/Sub (Fanout)**
1. Fanout exchange + per-consumer exclusive auto-delete queue
2. Use cases: cache invalidation, config refresh
3. GeoQ: tile-cache invalidation across web tier

### **3.4 Topic Routing**
1. Default choice for domain events
2. Producers know nothing about consumer subscriptions
3. New consumer = new binding pattern (zero producer change)

### **3.5 RPC over Broker**
1. `reply_to` + `correlation_id` pattern
2. Almost always wrong choice — use HTTP or move to async
3. Legitimate: dynamic responder location, firewalled backend

## **4. Topology & Operations**

### **4.1 Vhosts, Users, Permissions**
1. Vhost = logical broker namespace
2. Permissions: regex over (configure / write / read)
3. Always separate prod / non-prod vhosts
4. Per-tenant vhost works to ~hundreds, not millions

### **4.2 Clustering & Quorum Queues**
1. Classic mirrored queues — DEPRECATED, removed in 4.0
2. Quorum queues use Raft consensus (default since 3.10)
3. Majority-of-replicas commit semantics
4. **Never run 2-node cluster** (quorum loss on single failure)
5. 3 or 5 node clusters; replication = 2-3× write IOPS

### **4.3 Streams (3.9+)**
1. Append-only log queue type (`x-queue-type: stream`)
2. Consumer-tracked offsets, replay supported
3. Closes the "Kafka-ish" gap inside RabbitMQ
4. Higher throughput than classic/quorum queues

### **4.4 Federation vs Shovel**
1. **Shovel** — point-to-point, simple, configured per-link
2. **Federation** — exchange mirrors upstream, dynamic
3. Both ops-heavy; prefer app-level bridge for new builds

### **4.5 Management & Monitoring**
1. Management UI on port 15672 (queue browse, manual republish)
2. Prometheus exporter for metrics
3. Alert thresholds:
   - `messages_unacked > N` for >5min (consumer stuck)
   - `messages_ready` rising trend (consumer lag)
   - `disk_free_bytes` near `disk_free_limit` (WILL block publishes)
   - `resident_memory > 60% vm_memory_high_watermark`

## **5. Real-World Pipelines**

### **5.1 GeoQ — Geospatial Asset Tracking (Node.js)**
1. Stack: Hapi.js + amqplib + Redis + MongoDB
2. Topic exchange `tracking.events`, routing `tracking.{tenant}.{assetType}.{event}`
3. Quorum queues for ingest + archive (compliance)
4. Prefetch=4 on enrichment workers (200ms p95 work)
5. TTL+DLX retry: 30s wait → max 5 retries → permanent DLQ
6. Fanout for tile-cache invalidation
7. Redis dedup on `tracker_id+timestamp` at gateway
8. **Five microservices messaging patterns used:**
   - **Command/task queues** — `tracking.enrich`, `tracking.archive` with 8-16 competing consumers each
   - **Event bus** — `tracking.events` topic exchange; subscribers bind their own patterns (`tracking.acme.#`, `tracking.*.fleet-truck.ping`, `tracking.#`)
   - **Saga / RPC** — request/reply with `replyTo` + `correlationId` for geo-service segment lookups (mostly regretted; replaced with HTTP except for firewalled paths)
   - **Cache invalidation fanout** — `cache.invalidations` exchange, exclusive auto-delete queue per web instance, evicts local LRU + Redis tiles
   - **Async I/O offload** — third-party fleet webhook ingest (validate → publish → 200 in <50ms), CSV bulk import (S3 → publish job → 202)

### **5.2 tai-portal — Transactional Outbox (.NET)**
1. Topic exchange `portal.events`, durable
2. Singleton `IConnection` with auto-recovery
3. Sync publisher confirm (`WaitForConfirmsOrDie`)
4. Persistent messages (`DeliveryMode=2`)
5. `MessageId = OutboxMessage.Guid` for downstream dedup
6. Producer declares only its exchange — never queues
7. **Five microservices messaging patterns (Stage 1B live + Stage 2-3 designed):**
   - **Command/task queues** *(live)* — outbox publisher itself: multi-replica via `SELECT FOR UPDATE SKIP LOCKED`; future `portal.notifications.email` for SendGrid workers
   - **Event bus** *(live producer, planned consumers)* — `portal.events` topic exchange; subscribers bind by pattern (DocViewer `security.privilege-change`, audit-warehouse `security.#`, admin firehose `#`)
   - **Saga orchestration** *(designed)* — borrower onboarding (privilege grant → KYC → docs → e-sign → loan-app); choreography via integration events + MassTransit Saga state machine (NOT request/reply — GeoQ lesson)
   - **Cache invalidation fanout** *(designed)* — `portal.cache-invalidations` to evict per-user privilege cache on entitlement change (TTL too slow for permissions)
   - **Async I/O offload** *(designed)* — PDF generation (4-8s), bulk CSV privilege import, outbound webhook delivery with TTL+DLX retry chain
8. **The arc:** today RabbitMQ does just one job; architecture leaves space for the other four via `IIntegrationEventPublisher` swap point + topic exchange + routing-key convention

### **5.3 Anti-Patterns (Both Projects)**
1. Connection-per-publish → file descriptor exhaustion
2. Channel sharing across threads → sporadic frame errors
3. `noAck=true` on important work → silent loss
4. `prefetch=unlimited` → OOM on burst
5. Re-queue without retry-count → poison-message hot loop
6. Producer declaring consumer queues → coupling
7. 2-node cluster → quorum loss

## **6. Interview Talking Points**

### **6.1 L1: Junior**
1. Queue stores; exchange routes
2. `autoAck=true` = "fire and forget" = silent loss on crash

### **6.2 L2: Mid-Level**
1. Topic = default for domain events; direct = exact match; fanout = broadcast
2. Prefetch tuning: `p95_work_ms / network_rtt_ms`
3. Three durability flags must ALL be set
4. **AMQP 0.9.1 vs 1.0**: different protocols sharing a name
   - 0.9.1 broker-centric, 1.0 peer-to-peer / link-oriented
   - 1.0 wins: credit-based flow control, standard message format, disposition frames

### **6.3 L3: Senior**
1. One connection per process, channels per flow (TCP cost)
2. Quorum queues = Raft = no split brain (vs classic mirrored)
3. DLQ = work → retry-tier (TTL+DLX) → permanent DLQ; track via `x-death`
4. **When to reach for AMQP 1.0** (vs 0.9.1)
   - Azure Service Bus target — 1.0 is its native protocol
   - Specific 1.0 feature pays off (link credits when prefetch tuning fails)
   - Cross-broker portability is funded requirement
   - Otherwise client-ecosystem maturity wins: `amqplib` (Node) and `RabbitMQ.Client` (.NET) are still 0.9.1-first in 2026
5. **Why both my projects are 0.9.1** (not protocol ignorance)
   - GeoQ 2017: RabbitMQ 1.0 was experimental plugin; `amqplib` 0.9.1-only — no real choice
   - tai-portal 2025: .NET ecosystem (RabbitMQ.Client, MassTransit) still 0.9.1-first; outbox uses RabbitMQ-specific features (DLX, x-death) anyway

### **6.4 Staff: Architecture**
1. RabbitMQ vs Kafka decision tree:
   - Replay needed? → Kafka
   - Tasks (DLQ, complex routing) vs streaming?
   - What's already in ops?
2. Multi-region: app-level bridge > cloud-native (SNS/EventBridge) > federation
3. **"AMQP everywhere" portability is partial**:
   - Wire protocol portable; address conventions, topology mgmt, DLQ semantics broker-specific
   - Real abstraction lives at app layer (`IIntegrationEventPublisher`, MassTransit), not protocol
   - JDBC analogy: portable wire, dialect-specific code
