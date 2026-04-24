---
title: RabbitMQ — Reference Guide
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-24
relatedTopics:
  - Message-Queues (survey)
  - RabbitMQ + Outbox Case Study (tai-portal)
  - Distributed-Systems
  - Async-Concurrency
  - Caching
stack:
  - backend
  - infra
---

[🧠 **View Interactive Mindmap**](./rabbitmq-mindmap.md)

## Table of Contents

1. **AMQP 0.9.1 Fundamentals**
   - 1.1 [Protocol & Mental Model](#protocol--mental-model)
   - 1.2 [Connection vs Channel](#connection-vs-channel)
   - 1.3 [Exchanges (Direct, Fanout, Topic, Headers)](#exchanges-direct-fanout-topic-headers)
   - 1.4 [Queues & Bindings](#queues--bindings)
   - 1.5 [Routing Key Semantics](#routing-key-semantics)

2. **Reliability Building Blocks**
   - 2.1 [Acknowledgments (ack / nack / reject)](#acknowledgments-ack--nack--reject)
   - 2.2 [Publisher Confirms](#publisher-confirms)
   - 2.3 [Persistence (Durable + Persistent)](#persistence-durable--persistent)
   - 2.4 [Dead-Letter Exchanges & TTL](#dead-letter-exchanges--ttl)
   - 2.5 [Idempotency & Delivery Semantics](#idempotency--delivery-semantics)

3. **Consumer Patterns**
   - 3.1 [Competing Consumers (Work Queue)](#competing-consumers-work-queue)
   - 3.2 [Prefetch / QoS](#prefetch--qos)
   - 3.3 [Pub/Sub (Fanout)](#pubsub-fanout)
   - 3.4 [Topic Routing](#topic-routing)
   - 3.5 [RPC over RabbitMQ](#rpc-over-rabbitmq)

4. **Topology & Operations**
   - 4.1 [Vhosts, Users, Permissions](#vhosts-users-permissions)
   - 4.2 [Clustering & Quorum Queues](#clustering--quorum-queues)
   - 4.3 [Streams (RabbitMQ 3.9+)](#streams-rabbitmq-39)
   - 4.4 [Federation vs Shovel](#federation-vs-shovel)
   - 4.5 [Management UI & Monitoring](#management-ui--monitoring)

5. **Real-World Pipelines**
   - 5.1 [GeoQ — Geospatial Asset Tracking (Node.js)](#geoq--geospatial-asset-tracking-nodejs)
   - 5.2 [tai-portal — Transactional Outbox (.NET)](#tai-portal--transactional-outbox-net)
   - 5.3 [Anti-Patterns Observed Across Both](#anti-patterns-observed-across-both)

6. **Knowledge Deep Dive & Q&A**
   - 6.1 **L1: Junior**
     - 6.1.1 [Queue vs exchange — the one-line answer](#queue-vs-exchange--the-one-line-answer)
     - 6.1.2 [Why is `autoAck=true` dangerous?](#why-is-autoacktrue-dangerous)
   - 6.2 **L2: Mid-Level**
     - 6.2.1 [Direct vs Topic vs Fanout — when to pick each](#direct-vs-topic-vs-fanout--when-to-pick-each)
     - 6.2.2 [What does `prefetch=1` actually do?](#what-does-prefetch1-actually-do)
     - 6.2.3 [Why three independent durability flags?](#why-three-independent-durability-flags)
   - 6.3 **L3: Senior**
     - 6.3.1 [Connection-per-publish — why it's a production-killer](#connection-per-publish--why-its-a-production-killer)
     - 6.3.2 [Quorum vs classic mirrored queues](#quorum-vs-classic-mirrored-queues)
     - 6.3.3 [DLQ vs retry-with-backoff — the real-world pattern](#dlq-vs-retry-with-backoff--the-real-world-pattern)
   - 6.4 **Staff: Architecture**
     - 6.4.1 [RabbitMQ vs Kafka — the decision tree](#rabbitmq-vs-kafka--the-decision-tree)
     - 6.4.2 [Multi-region: federation, shovel, or app-level bridge?](#multi-region-federation-shovel-or-app-level-bridge)

7. [Cross-References](#cross-references)

---

## TL;DR

<span style="color: #33b5e5; font-weight: bold;">RabbitMQ</span> is a smart broker implementing <span style="color: #33b5e5; font-weight: bold;">AMQP 0.9.1</span>: producers publish to <span style="color: #33b5e5; font-weight: bold;">exchanges</span>, exchanges route to <span style="color: #33b5e5; font-weight: bold;">queues</span> via <span style="color: #33b5e5; font-weight: bold;">bindings</span>, consumers pull from queues over long-lived <span style="color: #33b5e5; font-weight: bold;">channels</span> on a single TCP <span style="color: #33b5e5; font-weight: bold;">connection</span>. <span style="color: #00C851; font-weight: bold;">Guaranteed delivery</span> requires *three* independent durability flags (durable exchange + durable queue + persistent message) plus <span style="color: #00C851; font-weight: bold;">publisher confirms</span> on the producer side and <span style="color: #00C851; font-weight: bold;">manual acknowledgments</span> with bounded <span style="color: #33b5e5; font-weight: bold;">prefetch</span> on the consumer side — anything missing degrades the guarantee. RabbitMQ's superpower over Kafka is rich routing (<span style="color: #33b5e5; font-weight: bold;">topic exchanges</span>, header matching, native <span style="color: #00C851; font-weight: bold;">DLQ</span>) for transient task distribution; Kafka wins for replay and append-only event streaming. Real-world projects use RabbitMQ for two characteristic shapes: <span style="color: #33b5e5; font-weight: bold;">work queues</span> distributing compute-heavy jobs across consumer pools (GeoQ's geospatial enrichment workers) and <span style="color: #33b5e5; font-weight: bold;">domain-event fan-out</span> via the <span style="color: #00C851; font-weight: bold;">Transactional Outbox</span> pattern (tai-portal). The senior trade-off to articulate in interviews: RabbitMQ <span style="color: #ffbb33; font-weight: bold;">deletes on ack</span> (no replay, no rebuild), so consumers must be idempotent and any "I want to reprocess last month" requirement should push you toward Kafka.

---

## Deep Dive

### AMQP 0.9.1 Fundamentals

#### Protocol & Mental Model

##### What
<span style="color: #33b5e5; font-weight: bold;">AMQP 0.9.1</span> is the wire protocol most RabbitMQ deployments speak. It is a binary, frame-oriented protocol over TCP with a fixed model: producers publish to **exchanges**, exchanges decide which **queues** receive a message based on **bindings**, and consumers subscribe to queues. RabbitMQ is the prototypical "smart broker, dumb consumer" implementation.

##### Why
A consumer doesn't ask "where should this go?" It asks "give me the next message off this queue." The broker takes responsibility for routing, retention, fan-out, and (with quorum queues) replicated durability. This is the inverse of <span style="color: #33b5e5; font-weight: bold;">Kafka</span>'s model where the broker is "dumb" (an ordered append-only log) and the consumer manages offsets.

##### How
The mental model in five entities:
- **Connection** — one TCP socket. Expensive to create (~tens of ms with TLS).
- **Channel** — a logical session multiplexed over a connection. Cheap. All operations (publish, declare, ack) happen on a channel.
- **Exchange** — routing decision-maker. Receives messages, looks at bindings, decides which queues get a copy.
- **Queue** — FIFO buffer with extra rules. Stores messages until a consumer acks them.
- **Binding** — `(queue, exchange, routing-key-pattern)` triple. The routing rule.

##### When
Use AMQP 0.9.1 (the default RabbitMQ protocol) for everything unless you specifically need MQTT (RabbitMQ supports it via plugin for IoT) or STOMP. AMQP 1.0 is a different protocol — RabbitMQ's 1.0 plugin exists but the ecosystem and patterns documented online almost universally assume 0.9.1.

##### Trade-offs
The smart-broker model means routing logic lives in broker config (exchanges, bindings, policies). On the upside that's declarative and inspectable in the management UI. On the downside, <span style="color: #ff4444; font-weight: bold;">topology drift</span> is a real operational hazard — if a producer expects an exchange to exist but ops never declared it, you get silent message loss until somebody notices the drop.

---

#### Connection vs Channel

##### What
A **connection** is a TCP socket plus AMQP handshake. A **channel** is a virtual lightweight session inside a connection. AMQP multiplexes many channels over one connection.

##### Why
TCP connections are expensive: socket open + TLS negotiate + AMQP handshake + auth = tens to hundreds of milliseconds. Channels are cheap: a couple of frames. The right pattern is **one connection per process, many channels** — typically one channel per thread (or per goroutine, or per asynchronous publisher in Node.js).

##### How
In tai-portal, `RabbitMqConnectionProvider` is registered as a singleton and exposes a single `IConnection`. `RabbitMqPublisher.PublishAsync` calls `_connection.CreateModel()` (creates a channel) per publish, scoped to a `using` block:

```csharp
// libs/core/infrastructure/Messaging/RabbitMqPublisher.cs
using var channel = _connectionProvider.Connection.CreateModel();
channel.ConfirmSelect();
// ... publish ...
channel.WaitForConfirmsOrDie(TimeSpan.FromMilliseconds(timeoutMs));
```

In GeoQ (`amqplib` on Node.js) the same pattern:

```javascript
// once at startup
const connection = await amqp.connect(process.env.RABBIT_URL);
process.once('SIGINT', () => connection.close());

// per worker / per publisher
const channel = await connection.createChannel();
await channel.assertExchange('tracking.events', 'topic', { durable: true });
await channel.publish('tracking.events', `tracking.${tenant}.${assetType}.ping`, payload, {
  persistent: true,
  contentType: 'application/json',
});
```

##### When
- One connection per app process (or one per producer + one per consumer if you want tx isolation).
- One channel per concurrent publishing/consuming flow. Don't share a channel across threads — channels are not thread-safe.
- Long-running consumer loop = long-lived channel. Don't recreate per message.

##### Trade-offs
- <span style="color: #ff4444; font-weight: bold;">Connection-per-publish</span> is the most common production-killer. At even modest load it exhausts file descriptors and the broker's connection table.
- <span style="color: #ff4444; font-weight: bold;">Sharing a channel across threads</span> in .NET / Java is undefined behavior and produces sporadic frame errors that look like network bugs. Use a channel pool keyed by thread or use the async `IModel.BasicPublishAsync` patterns once they stabilize.
- Channels die: an unhandled exception on the consumer side closes the channel. Always wire the `ModelShutdown` / `channel.on('close')` event and recreate.

---

#### Exchanges (Direct, Fanout, Topic, Headers)

##### What
An **exchange** is the routing decision-maker. RabbitMQ ships four built-in exchange types, each with a different routing rule:

| Type | Routing rule |
|---|---|
| **direct** | Deliver to queues whose binding key **equals** the message routing key |
| **fanout** | Deliver to **every** bound queue (routing key ignored) |
| **topic** | Deliver to queues whose binding pattern **matches** the routing key (`*` = one word, `#` = zero or more words) |
| **headers** | Match on message **header dict** instead of routing key (rarely used) |

There's also the unnamed "default exchange" (empty string `""`) — a direct exchange where every queue is implicitly bound by its own name. Useful for ad-hoc work queues.

##### Why
Different exchange types encode different fan-out and filtering decisions. Picking the right one is the single biggest topology decision: it's hard to change after consumers are deployed.

##### How
**tai-portal — topic exchange** (`portal.events`):

```csharp
// libs/core/infrastructure/Messaging/RabbitMqPublisher.cs
channel.ExchangeDeclare(
  exchange: "portal.events",
  type: ExchangeType.Topic,
  durable: true,
  autoDelete: false);
```

Routing keys derived from CLR type names: `PrivilegeChangeEvent` → `security.privilege-change`. Consumers can bind to `security.#` (everything in security) or `security.privilege-*` (any privilege event).

**GeoQ — topic exchange** (`tracking.events`):

Routing key shape: `tracking.{tenantId}.{assetType}.{event}` — e.g. `tracking.acme.fleet-truck.ping`, `tracking.acme.fleet-truck.geofence-enter`, `tracking.bigco.iot-sensor.battery-low`.

This let us bind:
- Live-dashboard consumer per tenant: `tracking.acme.#`
- Geofencing analytics: `tracking.*.*.geofence-*`
- Compliance archiver: `tracking.#` (everything)
- Fleet alerts: `tracking.*.fleet-truck.*`

A single topic exchange supported four very different consumer shapes without adding routing logic to producers.

**Fanout — broadcast** (used in GeoQ for tile-cache invalidation):

```javascript
await channel.assertExchange('tile-cache.invalidate', 'fanout', { durable: true });
// Every web tier instance binds an exclusive auto-delete queue:
const { queue } = await channel.assertQueue('', { exclusive: true });
await channel.bindQueue(queue, 'tile-cache.invalidate', '');
```

When upstream data shifted (e.g. new road geometry), one publish hit every web tier's local Redis cache.

##### When
- **direct** — small fixed set of routing keys, exact match. Classic example: log severity (`info`, `warn`, `error`) routed to per-severity queues.
- **fanout** — true broadcast (cache invalidation, "everyone refresh now").
- **topic** — anything with hierarchical routing or where consumers want to subscribe to slices. **Default choice for domain events.**
- **headers** — when routing depends on multiple message attributes. In ten years I have used this exactly once.

##### Trade-offs
- Topic exchanges with high binding count and high publish rate hurt: each publish does pattern matching across all bindings. Mitigated by quorum queues and good routing-key hierarchy. Don't put millions of bindings on one exchange.
- <span style="color: #ff4444; font-weight: bold;">Routing-key explosion</span>: encoding too much in the routing key (`{tenant}.{user}.{event}`) means consumers binding to `*.*.event-x` is fine, but binding to `tenant.*.*` over a long-lived high-cardinality `user` namespace creates many short-lived bindings and operational headaches. Keep routing keys at 3-5 segments.

---

#### Queues & Bindings

##### What
A **queue** is a FIFO buffer (with caveats — priority and consumer cancellation can reorder). A **binding** is a `(exchange, queue, routing-key-pattern)` triple stored in the broker.

Queue properties that change everything:
- `durable` — survives broker restart (the queue itself, not necessarily its messages)
- `exclusive` — only the declaring connection can use it; auto-deleted when that connection closes
- `auto-delete` — deleted when the last consumer unsubscribes
- `arguments` — extension point: `x-message-ttl`, `x-max-length`, `x-dead-letter-exchange`, `x-queue-type` (`quorum` / `classic` / `stream`), `x-max-priority`

##### Why
Queue declarations are **idempotent** — calling `assertQueue` twice with matching properties is a no-op. Calling it twice with *different* properties throws `PRECONDITION_FAILED`. This is the source of an enormous number of production incidents: somebody changes `durable: true` to `durable: false` (or adds `x-message-ttl`) and a redeploy crashes because the queue already exists with different properties.

##### How
**tai-portal** declares the exchange but NOT the queues — consumers (DocViewer, future audit worker) own their queue declarations. The producer should never declare consumer-owned queues, since the producer doesn't know the consumer's needs (durability? TTL? max-length?).

**GeoQ** ingest queue:

```javascript
await channel.assertQueue('tracking.ingest', {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',          // Raft-replicated for durability
    'x-message-ttl': 24 * 60 * 60_000, // 24h TTL — late pings useless
    'x-dead-letter-exchange': 'tracking.dead',
  },
});
await channel.bindQueue('tracking.ingest', 'tracking.events', 'tracking.*.*.ping');
```

##### When
- `durable: true` — almost always, unless the queue is explicitly ephemeral (live dashboard subscriber that doesn't care about messages from before it connected).
- `exclusive: true` — for per-connection ephemeral queues (RPC reply queues, dashboard subscribers).
- `auto-delete: true` — when the queue's purpose ends with the consumer's session.

##### Trade-offs
- <span style="color: #ff4444; font-weight: bold;">Queue declaration drift</span>: producer declares with one set of arguments, consumer with another. The first declarer wins; the second crashes. Mitigation: the consumer should declare the queue (it owns its semantics); producers only declare exchanges.
- An <span style="color: #ff4444; font-weight: bold;">unbounded queue</span> (no `x-max-length`, no consumer running) will consume disk forever. Add a max-length policy as a safety net even if you "trust" your consumers.

---

#### Routing Key Semantics

##### What
A routing key is a UTF-8 string up to 255 bytes. For topic exchanges it's interpreted as dot-separated words. Two wildcards: `*` matches exactly one word, `#` matches zero or more words.

##### Why
Routing keys are the contract between producer and consumer. They are stable identifiers that consumer-side bindings depend on; renaming a routing key is a breaking change at the topology level.

##### How
Conventions that survive at scale:
- `<bounded-context>.<aggregate>.<event>` — e.g. `security.privilege.changed`, `inventory.shipment.dispatched`.
- Use kebab-case inside segments. PascalCase in the middle of routing keys ages badly.
- Reserve the leftmost segment for the bounded context — it's the natural binding granularity.
- Encode tenant or region in the routing key only if consumers regularly bind to a single tenant. Otherwise put it in headers/payload.

##### When
A topic-routing-key-driven design works best when most consumers want a slice of all events. If most consumers want everything, fanout is simpler. If consumers want one specific event type each, direct is simpler.

##### Trade-offs
Hierarchies bake assumptions in. We started GeoQ with `tracking.{tenant}.{assetType}.{event}` and later wanted analytics across asset types per region. Region wasn't in the routing key, so we either re-published (with a richer key) or filtered consumer-side. Pick a hierarchy you'd be willing to live with for two years.

---

### Reliability Building Blocks

#### Acknowledgments (ack / nack / reject)

##### What
After RabbitMQ delivers a message to a consumer, it remains in an **unacked** state until the consumer signals one of:
- `basicAck` — done, delete from queue
- `basicNack(requeue: true)` — failed, put it back (or send to DLX if rules say)
- `basicNack(requeue: false)` — failed, send to DLX (or drop if no DLX)
- `basicReject` — same as nack-single, no `multiple` flag

If the consumer's channel closes (crash, network drop) without ack, **the broker requeues** the message to the head of the queue.

##### Why
Acknowledgments turn the broker → consumer hop into an at-least-once guarantee. The broker doesn't delete the message until somebody confirmed they processed it. Combined with publisher confirms (producer → broker), the end-to-end guarantee is at-least-once delivery — with consumer-side idempotency required for correctness.

##### How
**GeoQ enrichment worker** (Node.js, `amqplib`):

```javascript
await channel.consume('tracking.enrich', async (msg) => {
  if (!msg) return; // consumer cancelled by broker
  try {
    const ping = JSON.parse(msg.content.toString());
    const enriched = await enrichWithMapMatchAndTraffic(ping); // ~200ms p95
    await mongo.collection('tracks').insertOne(enriched);
    channel.ack(msg);
  } catch (err) {
    if (isTransientError(err)) {
      channel.nack(msg, false, true);   // requeue
    } else {
      channel.nack(msg, false, false);  // -> DLX
    }
  }
}, { noAck: false });
```

The `try/catch` boundary is the per-message transaction. Acks happen on success; nacks distinguish transient (DB hiccup, retry) from poison (malformed payload, send to DLQ).

##### When
- Always run with `noAck: false` (manual ack) for any message that matters.
- Ack **after** the side effect succeeded. Acking before the work is "fire and pray."
- Use `nack(requeue=false)` + DLX for poison messages so they don't loop forever.

##### Trade-offs
- <span style="color: #ff4444; font-weight: bold;">Auto-ack</span> (`noAck: true`) is "fire and forget." Consumer crashes mid-work? Message gone. Only use it for telemetry where loss is acceptable.
- <span style="color: #ff4444; font-weight: bold;">Re-queueing on failure without backoff</span> creates "poison message loops" — same bad message infinitely retried, blocking the queue head. Pair `nack(requeue=true)` with retry-count headers and a max-retry → DLX rule.
- Late acks: if a worker takes longer than the heartbeat (default 60s) without sending any frame, the broker thinks the connection is dead and requeues. Solution: send a heartbeat / use `consumer_timeout` queue argument deliberately.

---

#### Publisher Confirms

##### What
A channel-level mode (`channel.confirmSelect()` in Java/.NET, `channel.confirm()` in some clients) that makes the broker send back a `basic.ack` (or `basic.nack`) for every published message. Without this, `basic.publish` is fire-and-forget.

##### Why
Without publisher confirms, you cannot tell whether the broker received your message. A network blip, a broker restart, a queue not yet declared — all silent failures. Confirms are the producer-side counterpart to consumer acks: they convert producer → broker into at-least-once.

##### How
**Synchronous confirm** (tai-portal — one message per publish):

```csharp
// libs/core/infrastructure/Messaging/RabbitMqPublisher.cs
channel.ConfirmSelect();
// ... publish ...
channel.WaitForConfirmsOrDie(TimeSpan.FromMilliseconds(_options.ConfirmTimeoutMs));
```

Throws on NACK or timeout. Simple, ~1k msg/s ceiling.

**Async batch confirm** (GeoQ — high-throughput ingest):

```javascript
await channel.confirmSelect();
const pendingByDeliveryTag = new Map();
let nextDeliveryTag = 1;

channel.on('ack', ({ deliveryTag, multiple }) => {
  if (multiple) {
    for (const tag of pendingByDeliveryTag.keys()) {
      if (tag <= deliveryTag) {
        pendingByDeliveryTag.get(tag).resolve();
        pendingByDeliveryTag.delete(tag);
      }
    }
  } else {
    pendingByDeliveryTag.get(deliveryTag)?.resolve();
    pendingByDeliveryTag.delete(deliveryTag);
  }
});
channel.on('nack', /* similar, with reject() */);

function publishWithConfirm(routingKey, payload) {
  return new Promise((resolve, reject) => {
    const tag = nextDeliveryTag++;
    pendingByDeliveryTag.set(tag, { resolve, reject });
    channel.publish('tracking.events', routingKey, Buffer.from(payload), { persistent: true });
  });
}
```

This pattern handled ~30k pings/sec on a single producer process.

##### When
- **Sync confirm** — when publish rate is low and code simplicity matters (outbox publisher, audit log writer).
- **Async batch confirm** — when publish rate exceeds RTT budget. The crossover is roughly when `1 / RTT < target_publish_rate`.

##### Trade-offs
- Confirms add latency: the publisher waits for the broker to write to disk (for persistent messages on durable queues) before acking. <span style="color: #ffbb33; font-weight: bold;">Single-publish confirm latency is ~1-3ms locally, ~10-50ms across regions.</span>
- The `mandatory` flag plus `basic.return` callback covers a *different* failure: "no queue is bound to receive this routing key." Confirm = "broker got it." Mandatory = "a queue exists for it." Use both for full coverage on critical paths.

---

#### Persistence (Durable + Persistent)

##### What
Three independent durability flags that all must be set for a message to survive a broker restart:
- **Durable exchange** — the exchange definition survives broker restart.
- **Durable queue** — the queue definition survives broker restart.
- **Persistent message** (`delivery_mode = 2`) — the message bytes are written to disk.

If any one is missing, the message is gone after restart.

##### Why
The product manager says "we can never lose a message." The senior engineer asks "OK — durable exchange? Durable queue? Persistent messages? Quorum or classic? `publisher_confirm_in_quorum`? `wait-for-confirms` after publish?" Each of those is a switch with its own default and its own failure mode.

##### How
```csharp
// tai-portal — exchange durable
channel.ExchangeDeclare("portal.events", ExchangeType.Topic, durable: true, autoDelete: false);
// ... and per message:
props.DeliveryMode = 2;  // persistent
```

```javascript
// GeoQ — durable queue + persistent message
await channel.assertQueue('tracking.ingest', { durable: true, arguments: { 'x-queue-type': 'quorum' }});
await channel.publish('tracking.events', routingKey, body, { persistent: true });
```

##### When
- Persistent messages on durable queues — for any business-meaningful event.
- Non-persistent messages on transient queues — for high-throughput telemetry where loss is acceptable (live dashboards, ephemeral metrics).

##### Trade-offs
- Persistence costs <span style="color: #ffbb33; font-weight: bold;">write IOPS</span>. On classic queues the broker `fsync`s; on quorum queues the Raft log is appended and replicated to the majority. Throughput per node drops 5-10× with persistence on classic queues vs transient. Quorum queues amortize better but add network round-trips for replication.
- "I declared the queue durable but messages still vanish" is almost always missing `persistent: true` (delivery_mode 2). The flags are independent.

---

#### Dead-Letter Exchanges & TTL

##### What
A **dead-letter exchange (DLX)** is a regular exchange that a queue routes "rejected" or "expired" messages to. Triggers:
- `nack`/`reject` with `requeue=false`
- Message TTL expires (`x-message-ttl` per message or per queue)
- Queue length limit reached (`x-max-length` with `overflow: drop-head`)

Combined with `x-message-ttl` you get scheduled redelivery: send to a "wait queue" with TTL=30s and DLX back to the work queue → automatic delayed retry.

##### Why
Without a DLX, a poison message either (a) loops forever in the queue head, blocking other consumers, or (b) gets silently dropped on `nack(requeue=false)`. Neither is acceptable in production.

##### How
**Retry with exponential backoff via TTL + DLX** (GeoQ enrichment retries):

```javascript
// 1. Work queue with DLX to "retry-30s" queue
await channel.assertQueue('tracking.enrich', {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'tracking.retry',
    'x-dead-letter-routing-key': '30s',
  },
});

// 2. Retry queue with TTL=30s, DLX back to work exchange
await channel.assertQueue('tracking.retry.30s', {
  durable: true,
  arguments: {
    'x-message-ttl': 30_000,
    'x-dead-letter-exchange': 'tracking.events',
    'x-dead-letter-routing-key': 'tracking.*.*.ping',
  },
});

// 3. After N retries (count via x-death header), route to permanent DLQ
// Consumer logic:
const retryCount = (msg.properties.headers['x-death']?.[0]?.count) ?? 0;
if (retryCount >= 5) {
  channel.publish('tracking.dead', '', msg.content, { persistent: true });
  channel.ack(msg);
} else {
  channel.nack(msg, false, false); // -> retry-30s -> back to work in 30s
}
```

##### When
- Always wire a DLX for any queue handling external input.
- TTL-based delayed retry is the simplest "exponential backoff" without writing a scheduler. RabbitMQ has a delayed-message plugin for arbitrary delays.

##### Trade-offs
- The `x-death` header accumulates an entry per dead-lettering, which means message size grows. Not unbounded with a max-retry cap, but worth knowing.
- DLX-routed messages keep the *original* routing key by default (not the dead-letter routing key). Use `x-dead-letter-routing-key` to override.

---

#### Idempotency & Delivery Semantics

##### What
RabbitMQ is **at-least-once** end-to-end (with publisher confirms + consumer acks). It is not exactly-once. Duplicates happen:
- Producer retries after a confirm timeout → broker has the message, producer publishes again.
- Consumer crashes mid-work → broker requeues, another consumer processes → if the first one had partially completed work that's externally visible, that work happened twice.

##### Why
The senior interview answer to "how do you achieve exactly-once?" is "you don't — you make consumers idempotent." Idempotency means processing the same message twice has the same end state as once.

##### How
Three idempotency strategies, in increasing strength:
1. **Natural idempotency** — operation is intrinsically idempotent (`SET x = 5`, `INSERT IF NOT EXISTS`).
2. **Dedup table keyed on message ID** — `INSERT INTO processed_messages (message_id) ON CONFLICT DO NOTHING` before doing the work; skip if already present. Pair with a TTL to prevent unbounded growth.
3. **Per-aggregate version check** — message carries an expected `version`, handler updates only if `current_version == expected - 1`. Older retries are silently dropped.

The `MessageId` AMQP property (= `OutboxMessage.Id` in tai-portal) is the canonical dedup key. RabbitMQ does not enforce uniqueness; the consumer must.

##### When
- Always assume duplicates. Even if you "never retry," broker restarts and network blips create duplicates.
- For external side effects (HTTP POST to third party, sending email): wrap with a dedup check and accept the cost.

##### Trade-offs
- Dedup table grows; needs TTL and indexing. ~1KB per message, ~1M messages/day = 1 GB. Plan capacity.
- The dedup check is itself a database write — it can become the throughput bottleneck. Batching helps.

---

### Consumer Patterns

#### Competing Consumers (Work Queue)

##### What
Multiple consumers attached to the **same queue**. The broker round-robins messages across them — each message goes to exactly one consumer.

##### Why
Horizontal scaling for compute-bound work. Spin up more workers, queue depth drops, throughput rises. No coordination needed — the broker does it.

##### How
GeoQ's enrichment workers were the canonical example: 8-16 Node.js processes per region, all consuming from `tracking.enrich`, prefetch=4 each. Map-matching a GPS ping against road geometry is ~200ms p95. With 12 workers × 4 prefetch we held steady at ~240 concurrent enrichments.

```javascript
await channel.prefetch(4);
await channel.consume('tracking.enrich', handler, { noAck: false });
```

##### When
- Compute-heavy work that's safely parallelizable (each ping is independent).
- Bursty load where you want to absorb spikes in queue depth and drain them with extra workers.

##### Trade-offs
- Round-robin is naive: a slow consumer holds messages just as long as a fast one. With prefetch > 1, slow consumers buffer ahead and starve fast ones. Either set prefetch=1 (loses pipelining) or accept some imbalance.
- Order is not preserved across consumers — two messages for the same asset can be processed in either order. If order matters per-key, use a partitioning scheme (consistent-hash exchange plugin, or partition-key in the routing key with one queue per partition).

---

#### Prefetch / QoS

##### What
The `basic.qos` setting (`channel.prefetch(N)`) controls how many unacked messages the broker will deliver to a single consumer at a time. Default is "unlimited" — which is almost never what you want.

##### Why
Without prefetch, the broker will fire-hose a fast consumer with thousands of unacked messages. If that consumer crashes, all of them get requeued — to the *back* of the queue (behind newer messages). Prefetch = the buffer between broker and consumer.

##### How
- **Prefetch=1** — strict serial processing per consumer. Maximum fairness; minimum pipelining. Use for very expensive, very rare work.
- **Prefetch=N** — pipeline N messages per consumer. The right N is roughly `network_rtt / mean_processing_time`, capped by memory.
- **Global prefetch** — applies to all consumers on a channel collectively. Almost always you want the per-consumer setting.

In tai-portal we don't tune prefetch — the outbox publisher publishes one batch row at a time, and the broker side consumers (DocViewer, etc.) are out of scope for Stage 1B.

In GeoQ we used prefetch=4 for enrichment (200ms work, 1ms RTT) and prefetch=50 for the lightweight aggregation worker (5ms work).

##### When
- Always set explicitly. Default is dangerous.
- Tune by: `prefetch ≈ ceil(p95_processing_time_ms / network_rtt_ms)`, then sanity-check memory.

##### Trade-offs
- Too low → underutilized consumer (waiting on broker round-trips between messages).
- Too high → poor failover (more messages requeued on crash) and fairness (slow consumer hoards).

---

#### Pub/Sub (Fanout)

##### What
One producer, many independent consumers, each receiving a copy. Implemented with a **fanout exchange** + one **exclusive auto-delete queue per consumer**.

##### How
GeoQ tile-cache invalidation: when an upstream service published new road geometry, every web-tier instance had to invalidate its local Redis cache.

```javascript
// Each web-tier instance at startup:
const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
await channel.bindQueue(queue, 'tile-cache.invalidate', '');
await channel.consume(queue, (msg) => {
  redis.del(msg.content.toString());
  channel.ack(msg);
});
```

When a web-tier instance restarted, the broker auto-deleted its old queue and the new instance got a fresh ephemeral one — no operator cleanup.

##### When
True broadcast use cases — config refresh, cache invalidation, "everyone refresh now."

##### Trade-offs
- Fanout doesn't scale with binding count linearly: each publish copies to every bound queue. With 100s of consumers it's fine; with 1000s it's worth measuring.
- Exclusive auto-delete queues are ephemeral by design. If the consumer disconnects mid-processing, in-flight messages are gone.

---

#### Topic Routing

Covered in [Exchanges](#exchanges-direct-fanout-topic-headers). Topic exchange is the default-choice fan-out mechanism whenever consumers want filtered slices.

---

#### RPC over RabbitMQ

##### What
Request/response over the broker. Producer sends a request with `reply_to` (a queue name) and `correlation_id`, consumer processes and publishes the response to `reply_to` with the same `correlation_id`.

##### Why
You shouldn't, usually. RPC over a broker is "synchronous over async," which adds latency without obvious payoff over a direct HTTP call. The legitimate cases:
- The responder's location is dynamic (load-balancer in the broker).
- The responder is on a network the requester can't reach directly (firewalled).

In ten years I have used this exactly twice, both regretted in retrospect.

##### How
The pattern is well-documented (`amqplib` has examples). Most teams either move the call to HTTP or push the work into a queue + later notification (event-driven).

##### Trade-offs
- Latency: 2× broker round-trip vs 1× HTTP RTT.
- Reply queue management is fiddly (dedicated per-client exclusive queue is the right pattern).

---

### Topology & Operations

#### Vhosts, Users, Permissions

##### What
A **vhost** is a logical broker — a namespace for exchanges, queues, bindings, users. Permissions are per-`(user, vhost)` triples: configure / write / read regex patterns over resource names.

##### Why
One physical broker, multiple logical environments. Production, staging, per-team — each a vhost. Permissions limit blast radius: a misconfigured app can't accidentally publish to a sibling team's exchange.

##### How
```bash
rabbitmqctl add_vhost tai-portal
rabbitmqctl set_permissions -p tai-portal portal-api '^portal\..*' '^portal\..*' '^portal\..*'
```

The three regexes match: `configure` (declare/delete), `write` (publish), `read` (consume / get). Empty string = deny all.

##### When
- Always run prod and non-prod on different vhosts (or different brokers).
- Per-tenant vhost can be a multi-tenancy strategy in itself, though it scales worse than a single vhost with routing-key isolation past a few hundred tenants.

##### Trade-offs
- Vhost is **not** a security boundary against a sufficiently determined operator — they share users in `default` admin scope. Use TLS, separate admin users, and audit logs.
- Cross-vhost routing requires shovel/federation, which adds complexity.

---

#### Clustering & Quorum Queues

##### What
RabbitMQ clusters share state across nodes. Pre-3.8, "high availability" meant **classic mirrored queues** (a leader queue with mirrors that copied messages). Mirrored queues had well-known split-brain failure modes and were **deprecated** in 3.x and removed in **RabbitMQ 4.0**.

**Quorum queues** (3.8+, default since 3.10) replace mirrored queues. They use the **Raft consensus algorithm** for leader election and replication. Writes commit when the majority of replicas have persisted them.

##### Why
"Can the cluster survive losing a node without losing messages?" requires either Raft (quorum queues) or external replication (streams). Without it, the queue lives on one broker, and if that broker goes down, the queue (and any non-replicated messages) is unavailable until it comes back.

##### How
```javascript
await channel.assertQueue('tracking.ingest', {
  durable: true,
  arguments: { 'x-queue-type': 'quorum' },
});
```

A 3-node cluster with `quorum_initial_group_size: 3` replicates writes to 2 of 3 (majority) before acking. Survives one-node failure transparently.

##### When
- Quorum queues for any production workload requiring HA.
- Classic queues (single-broker, no replication) are still fine for ephemeral ad-hoc queues (RPC reply queues, dashboard subscribers) where loss-on-broker-failure is acceptable.

##### Trade-offs
- Quorum queues require **odd cluster sizes** (3, 5) for proper majority.
- Replication overhead: 2-3× write IOPS depending on cluster size.
- Memory ceiling: quorum queues keep the in-flight log in memory. Set `x-max-in-memory-length` for large queues.
- <span style="color: #ff4444; font-weight: bold;">Don't run a 2-node cluster.</span> Majority of 2 is 2 — losing one node loses quorum, the queue blocks.

---

#### Streams (RabbitMQ 3.9+)

##### What
A separate queue type (`x-queue-type: stream`) backed by an append-only log. Consumers track their own offset, replay is supported, throughput is much higher than classic/quorum queues.

##### Why
Closes the "I want Kafka-ish replay but I'm already on RabbitMQ" gap. Useful for telemetry, audit logs, and any "I need to reprocess history" workload.

##### When
- High-throughput append-only data where consumers may need to start from offset 0.
- When you'd otherwise be tempted to add Kafka.

##### Trade-offs
- Different protocol (separate stream protocol port 5552, can also be consumed via AMQP 0.9.1 with offset tracking).
- Storage grows unbounded unless retention is set (`x-max-length-bytes`, `x-max-age`).
- Smaller ecosystem than Kafka — fewer connectors, fewer learnings online.

---

#### Federation vs Shovel

##### What
Two ways to move messages between brokers:
- **Shovel** — broker reads from a queue on broker A and re-publishes to an exchange on broker B. Simple, point-to-point, configured per-link.
- **Federation** — broker A's exchange transparently mirrors a (declarative) upstream exchange on broker B. More dynamic but heavier.

##### When
- **Shovel** for one-shot migration ("move all messages from old broker to new") or bridging into a cluster from outside.
- **Federation** for steady-state cross-region or cross-cluster routing where the topology changes over time.

##### Trade-offs
Both add operational complexity. For new builds I'd push the cross-region story up a layer: producers publish locally, application-level bridges (or AWS SNS cross-region replication, or EventBridge) move events.

---

#### Management UI & Monitoring

##### What
The management plugin (port 15672) exposes:
- Real-time exchange/queue/connection/channel stats
- Queue browsing & manual republish
- Policy management
- HTTP API for automation (queue declaration, user mgmt, message stats)

For monitoring, the **Prometheus exporter plugin** exposes broker metrics in Prometheus format. Standard alert thresholds:

| Metric | Alert at |
|---|---|
| `rabbitmq_queue_messages_unacked` | > N for > 5 min (consumer stuck) |
| `rabbitmq_queue_messages_ready` | rising trend (consumer slower than producer) |
| `rabbitmq_connections` | sudden drop (consumer dying) |
| `rabbitmq_disk_free_bytes` | < high-water-mark threshold (broker will block publishes) |
| `rabbitmq_resident_memory_bytes` | > 60% of `vm_memory_high_watermark` |

##### Why
Three production failures are repeat offenders:
1. **Disk-full block** — RabbitMQ blocks publishes when free disk < `disk_free_limit`. Producers hang. The fix is to expand disk; the prevention is alerting at 2× the limit.
2. **Memory alarm** — same blocking behavior at memory high watermark. Tune queue sizes; consider lazy queues (`x-queue-mode: lazy`, classic-only) for very deep queues.
3. **Slow consumer** — queue depth grows, eventually hits `x-max-length` and starts dead-lettering or dropping. Catch via the `messages_ready` metric.

---

### Real-World Pipelines

#### GeoQ — Geospatial Asset Tracking (Node.js)

**Stack:** Hapi.js (HTTP), `amqplib` (RabbitMQ client), Redis (cache + dedup), MongoDB (storage).

**Pipeline:**

```
HTTP /track POST  ──┐
                    ├─► Hapi.js validate + dedup (Redis SETNX on tracker_id+timestamp)
                    │
GPS device push  ───┘            │
                                 ▼
                       publish('tracking.events',
                         routingKey='tracking.acme.fleet-truck.ping',
                         persistent=true)
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       tracking.ingest    tracking.live        tracking.archive
       (durable, quorum,  (exclusive per       (durable, quorum,
        TTL 24h)           dashboard)           no TTL)
              │                  │                  │
              ▼                  ▼                  ▼
       enrich-worker      WebSocket pump      compliance-archiver
       (prefetch=4,       (per tenant)        (batched MongoDB
        x12 instances)                         insert)
              │
              ▼
       MongoDB tracks collection (tenant-sharded)
              │
              ▼
       Aggregation worker (separate queue,
       batched 5min windows)
```

**Concrete patterns used:**
- **Topic routing** for slice-by-slice consumer subscription (live dashboard per tenant; analytics across tenants).
- **Prefetch=4** on enrichment (200ms work × 4 = 800ms in-flight per worker, fits memory).
- **TTL+DLX retry** for transient enrichment failures (mongo timeout → 30s wait → retry, max 5 retries → permanent DLQ).
- **Quorum queues** for `ingest` and `archive` — losing pings is a compliance issue.
- **Fanout** for tile-cache invalidation across web tier.
- **Redis dedup** on `tracker_id + timestamp` before publish — devices retransmit aggressively, idempotency starts at the gateway.

**Lessons learned (the hard way):**
- We initially used *one queue per tenant* via direct exchange. At ~200 tenants the management UI became unusable and exchange fanout cost became visible. Migrated to topic exchange + tenant in routing key + per-tenant queue *only where consumers needed isolation*.
- We initially had `prefetch=unlimited` on enrichment. A burst of 50k messages caused workers to OOM holding deserialized payloads. Prefetch=4 set as a hard rule.
- We had a `requeue=true` retry without count. A poison ping (corrupted GeoJSON) hot-looped on one worker for 18 hours before someone noticed disk thrash. DLX with retry-count was the immediate response.

---

#### tai-portal — Transactional Outbox (.NET)

Detailed walkthrough: [`rabbitmq-outbox-case-study.md`](./rabbitmq-outbox-case-study.md).

Quick recap of the RabbitMQ-specific pieces:
- **Topic exchange** `portal.events`, durable, declared lazily by the publisher (`RabbitMqPublisher.cs:86-99`).
- **Routing keys** derived from CLR type names: `PrivilegeChangeEvent` → `security.privilege-change`.
- **Publisher confirms**: `ConfirmSelect` + `WaitForConfirmsOrDie(timeout)` per publish (`RabbitMqPublisher.cs:50, 77`).
- **Singleton `IConnection`** in `RabbitMqConnectionProvider` with `AutomaticRecoveryEnabled = true`.
- **Persistent messages** (`DeliveryMode = 2`) so they survive broker restart.
- **No queues declared by the producer** — consumer applications own queue declarations.
- **`MessageId` = outbox row's `Guid`** for downstream consumer dedup.

The producer and the broker are the *only* RabbitMQ-touching pieces in this codebase. Consumer-side logic (dedup, idempotency, business handlers) is explicitly Stage-2 work.

---

#### Anti-Patterns Observed Across Both

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Connection-per-publish | File descriptor exhaustion, broker connection-table full | Singleton connection, per-publish channel |
| Sharing channel across threads | Sporadic frame errors, "unexpected channel close" | Channel per thread / per logical flow |
| `noAck: true` on important work | Messages vanish on consumer crash | Manual ack after work succeeds |
| `prefetch=unlimited` | Worker OOM on burst, unfair distribution | Set prefetch deliberately (1 to ~50) |
| Re-queue without retry-count | Poison-message hot loop | TTL+DLX with `x-death` count → permanent DLQ |
| Queue declared with mismatched args | `PRECONDITION_FAILED` on redeploy | Consumer owns queue declaration; one source of truth |
| No persistence on critical messages | Messages lost on broker restart | Three-flag combo: durable exchange + durable queue + persistent message |
| Producer declares consumer queues | Coupling; producer knows consumer durability needs | Producer declares only its own exchange |
| Routing key explosion | Slow topic match; ops nightmare | Cap routing keys at 3-5 segments; encode high-cardinality data in headers |
| 2-node cluster | Quorum loss on single node failure | 3 or 5 node clusters; never even numbers |

---

## Knowledge Deep Dive & Q&A

### L1: Junior

#### Queue vs exchange — the one-line answer
**Q:** What's the difference between a queue and an exchange?
**A:** A queue **stores** messages until a consumer takes them. An exchange **routes** messages to queues based on bindings. Producers publish to exchanges, never directly to queues (the "default exchange" is a syntactic shortcut that hides this).

#### Why is `autoAck=true` dangerous?
**Q:** What happens if my consumer crashes with `autoAck=true`?
**A:** RabbitMQ deletes the message **before** the consumer touches it (autoAck means ack-on-deliver). If the consumer crashes mid-work, the message is gone — there's nothing to redeliver. Always use manual ack (`noAck: false` / `autoAck: false`) and ack after the work succeeds.

---

### L2: Mid-Level

#### Direct vs Topic vs Fanout — when to pick each
**Q:** I have a "user-registered" event. Direct, topic, or fanout?
**A:** It depends on consumer fan-out shape:
- **Direct** if you have a small fixed set of routing keys and consumers want exact matches (`user.registered` vs `user.deactivated`).
- **Topic** if consumers want filtered slices (`user.*`, `*.registered`, `users.tenant1.#`). This is the default choice for domain events because it's flexible — adding a new consumer with a new binding pattern doesn't change producers.
- **Fanout** only if every consumer wants every message (rare, mostly cache invalidation).

In practice, ~80% of domain-event use cases land on topic.

#### What does `prefetch=1` actually do?
**Q:** I see `channel.prefetch(1)` everywhere. Is that the right default?
**A:** `prefetch=1` means the broker delivers at most one unacked message per consumer at a time — strict serial processing. It's the *safest* default but not always the *best* default. With `prefetch=N`, a consumer can pipeline: while it's processing message 1, message 2 is already in its socket buffer waiting. The right N depends on `(network RTT) / (mean processing time)`. For local broker + 200ms work, `prefetch=4` was the GeoQ sweet spot. For 5ms work, `prefetch=50`. For multi-second work, `prefetch=1` is fine — no pipelining benefit.

#### Why three independent durability flags?
**Q:** I marked the queue durable but messages still vanish on restart. Why?
**A:** Three flags must all be true for a message to survive a broker restart:
1. **Durable exchange** (exchange definition persists)
2. **Durable queue** (queue definition persists)
3. **Persistent message** (`delivery_mode=2` / `persistent: true` — message bytes written to disk)

Missing #3 is the most common mistake — the queue exists after restart, but the messages it held don't, because they were memory-only.

---

### L3: Senior

#### Connection-per-publish — why it's a production-killer
**Q:** Why does opening a fresh connection for each publish destroy throughput?
**A:** Connection setup is TCP + AMQP handshake + auth — typically 20-100ms with TLS. At 100 msgs/s with a connection per publish you've doubled your network load and the broker's connection-table grows toward `tcp_listen_options.backlog`. Once the kernel runs out of ephemeral ports (`net.ipv4.ip_local_port_range`) or file descriptors, the producer hangs. The fix is exactly one pattern: **one connection per process, channels per concurrent flow**. Channels are designed to be cheap; opening 100 channels per second is fine. Opening 100 connections per second will take down a small broker.

#### Quorum vs classic mirrored queues
**Q:** Why did RabbitMQ deprecate classic mirrored queues?
**A:** Classic mirrored queues had a flawed split-brain story. The "leader" had mirrors that *copied* messages, but the protocol for promoting a mirror to leader on failure was based on a custom synchronization mechanism that could lose messages under partial-partition scenarios. Operators saw mysterious "where did the messages go?" incidents in network blips.

Quorum queues use **Raft consensus** — a well-understood, mathematically grounded algorithm with clear failure semantics. A write commits when a *majority* of replicas have persisted it; leader election is deterministic; no split brain. The trade-off is replication overhead (~2× write IOPS) and a memory ceiling for in-flight log entries (`x-max-in-memory-length`).

For new clusters: always quorum queues for HA-required workloads. Mirrored queues were removed entirely in **RabbitMQ 4.0**.

#### DLQ vs retry-with-backoff — the real-world pattern
**Q:** A consumer gets a transient DB error. Just `nack(requeue=true)`?
**A:** That's the naive answer. The senior answer:
- Transient error → nack to a **wait queue** with TTL, DLX'd back to the work queue. This gives you exponential backoff for free — wait queues at 30s, 5min, 30min.
- After N retries (count via the `x-death` header) → route to a **permanent DLQ** that operators monitor and replay manually.
- Poison message (deserialization failure, schema violation) → straight to permanent DLQ without retry. Retrying a malformed message is wasted work.

The pattern is classic three-tier: work queue, retry queues (one per backoff tier), permanent DLQ. The RabbitMQ delayed-message exchange plugin can collapse the retry tiers into a single delay-with-arbitrary-ms exchange if you have it installed.

---

### Staff: Architecture

#### RabbitMQ vs Kafka — the decision tree
**Q:** New service. RabbitMQ or Kafka?
**A:** I ask three questions:
1. **Do consumers need to replay history?** Yes → Kafka. RabbitMQ deletes on ack; you cannot rebuild a consumer's view from scratch. (RabbitMQ Streams partially close this gap if you're already invested in RabbitMQ.)
2. **Is this transient task distribution or append-only event streaming?** Tasks (sending emails, enrichment workers, side effects) → RabbitMQ — DLQ, ack-per-message, complex routing are first-class. Streaming (audit logs, telemetry, > 100k events/s) → Kafka.
3. **What's the broker my team already operates?** Operational expertise is a real cost. If you have RabbitMQ ops dialed in, the breakeven for switching to Kafka is high.

For tai-portal: integration events for cross-app fan-out, low volume, no replay requirement → RabbitMQ.
For GeoQ ingest at 100k pings/sec sustained, with replay-from-7-days-ago a known requirement → would pick Kafka if starting today.

#### Multi-region: federation, shovel, or app-level bridge?
**Q:** Two regions, want events to flow both ways. RabbitMQ federation?
**A:** Three options, in order of complexity:
1. **App-level bridge** — separate brokers per region, each with its own outbox + worker. Cross-region delivery is just another consumer in region A that re-publishes to region B's broker. Most explicit, easiest to reason about.
2. **AWS / cloud-native** — SNS cross-region replication, EventBridge global rules, or Kafka MirrorMaker if you're on Kafka. Removes you from the broker-replication business entirely.
3. **RabbitMQ federation** — the broker mirrors upstream exchanges. Powerful but ops-heavy; you need to monitor link health, deal with credential rotation, and reason about failure modes (what if region A's broker is up but the federation link is down?).

For most builds I'd start with #1 (app-level), measure the operational burden, and consider #2 before ever reaching for #3. Federation is the right answer when you specifically need cross-broker routing of *unmodified* messages with no application logic in the middle.

---

## Cross-References

- **[[Message-Queues]]** — Survey of brokers (Kafka, SNS+SQS, EventBridge), AWS cost comparison, modular-monolith → microservices evolution
- **[[RabbitMQ + Outbox Case Study]]** — Hands-on tai-portal walkthrough: dual-write hazard, Unit-of-Work orchestrator, `SELECT FOR UPDATE SKIP LOCKED`, publisher confirms in context
- **[[Distributed-Systems]]** — Delivery semantics (at-most/at-least-once), idempotency strategies, CAP and quorum trade-offs
- **[[Async-Concurrency]]** — Channel/connection lifecycle in async runtimes; how prefetch interacts with the event loop in Node.js and `Task` scheduling in .NET
- **[[Caching]]** — Redis dedup at producer ingress (the GeoQ pattern), cache-invalidation fanout

---

## Further Reading

- [RabbitMQ Tutorials (1-7)](https://www.rabbitmq.com/tutorials) — Canonical worked examples; the "Tutorial 7" publisher confirms one is required reading.
- [RabbitMQ in Depth (Gavin Roy)](https://www.manning.com/books/rabbitmq-in-depth) — Best single book on AMQP semantics.
- [Quorum Queues design doc](https://www.rabbitmq.com/quorum-queues.html) — Raft-based replication explained.
- [Reasoning about RabbitMQ Streams](https://www.rabbitmq.com/streams.html) — When and why to use streams vs queues.

---

*Last updated: 2026-04-24*
