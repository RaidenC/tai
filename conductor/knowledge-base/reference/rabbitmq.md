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

1. **AMQP Fundamentals**
   - 1.1 [Protocol Landscape — 0.9.1 vs 1.0](#protocol-landscape--091-vs-10)
   - 1.2 [Mental Model (Smart Broker)](#mental-model-smart-broker)
   - 1.3 [Connection vs Channel (vs Session/Link in 1.0)](#connection-vs-channel-vs-sessionlink-in-10)
   - 1.4 [Exchanges (Direct, Fanout, Topic, Headers)](#exchanges-direct-fanout-topic-headers)
   - 1.5 [Queues & Bindings](#queues--bindings)
   - 1.6 [Routing Key Semantics](#routing-key-semantics)

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
     - 6.2.4 [What's actually different between AMQP 0.9.1 and 1.0?](#whats-actually-different-between-amqp-091-and-10)
   - 6.3 **L3: Senior**
     - 6.3.1 [Connection-per-publish — why it's a production-killer](#connection-per-publish--why-its-a-production-killer)
     - 6.3.2 [Quorum vs classic mirrored queues](#quorum-vs-classic-mirrored-queues)
     - 6.3.3 [DLQ vs retry-with-backoff — the real-world pattern](#dlq-vs-retry-with-backoff--the-real-world-pattern)
     - 6.3.4 [When would you reach for AMQP 1.0?](#when-would-you-reach-for-amqp-10)
   - 6.4 **Staff: Architecture**
     - 6.4.1 [RabbitMQ vs Kafka — the decision tree](#rabbitmq-vs-kafka--the-decision-tree)
     - 6.4.2 [Multi-region: federation, shovel, or app-level bridge?](#multi-region-federation-shovel-or-app-level-bridge)
     - 6.4.3 [Protocol portability — is "AMQP everywhere" real?](#protocol-portability--is-amqp-everywhere-real)

7. [Cross-References](#cross-references)

---

## TL;DR

<span style="color: #33b5e5; font-weight: bold;">RabbitMQ</span> is a smart broker implementing <span style="color: #33b5e5; font-weight: bold;">AMQP 0.9.1</span>: producers publish to <span style="color: #33b5e5; font-weight: bold;">exchanges</span>, exchanges route to <span style="color: #33b5e5; font-weight: bold;">queues</span> via <span style="color: #33b5e5; font-weight: bold;">bindings</span>, consumers pull from queues over long-lived <span style="color: #33b5e5; font-weight: bold;">channels</span> on a single TCP <span style="color: #33b5e5; font-weight: bold;">connection</span>. <span style="color: #00C851; font-weight: bold;">Guaranteed delivery</span> requires *three* independent durability flags (durable exchange + durable queue + persistent message) plus <span style="color: #00C851; font-weight: bold;">publisher confirms</span> on the producer side and <span style="color: #00C851; font-weight: bold;">manual acknowledgments</span> with bounded <span style="color: #33b5e5; font-weight: bold;">prefetch</span> on the consumer side — anything missing degrades the guarantee. RabbitMQ's superpower over Kafka is rich routing (<span style="color: #33b5e5; font-weight: bold;">topic exchanges</span>, header matching, native <span style="color: #00C851; font-weight: bold;">DLQ</span>) for transient task distribution; Kafka wins for replay and append-only event streaming. Real-world projects use RabbitMQ for two characteristic shapes: <span style="color: #33b5e5; font-weight: bold;">work queues</span> distributing compute-heavy jobs across consumer pools (GeoQ's geospatial enrichment workers) and <span style="color: #33b5e5; font-weight: bold;">domain-event fan-out</span> via the <span style="color: #00C851; font-weight: bold;">Transactional Outbox</span> pattern (tai-portal). The senior trade-off to articulate in interviews: RabbitMQ <span style="color: #ffbb33; font-weight: bold;">deletes on ack</span> (no replay, no rebuild), so consumers must be idempotent and any "I want to reprocess last month" requirement should push you toward Kafka.

---

## Deep Dive

### AMQP Fundamentals

#### Protocol Landscape — 0.9.1 vs 1.0

##### What
"AMQP" refers to two different wire protocols that share the name and almost nothing else:
- **AMQP 0.9.1** (2008) — the protocol RabbitMQ was built around. Broker-centric: exchanges, queues, bindings, and routing keys are baked into the protocol itself.
- **AMQP 1.0** (2011, ratified as ISO/IEC 19464:2014 by OASIS) — a redesigned peer-to-peer / link-oriented protocol. No exchanges or queues in the protocol — those are broker-side addressing conventions.

In April 2026 the picture is:
- **Standard / cloud-native protocol:** AMQP **1.0** — Azure Service Bus speaks it natively, AWS MQ supports it (both ActiveMQ and Apache Artemis backends), IBM MQ (v9+), ActiveMQ Artemis, Apache Qpid. **RabbitMQ 4.0** (Sept 2024) made it a first-class core protocol (no plugin needed).
- **Most production RabbitMQ code in the wild:** AMQP **0.9.1** — `RabbitMQ.Client`, `amqplib`, `pika`, Spring AMQP all default to it. The exchange/queue/binding model is a 0.9.1-protocol feature; AMQP 1.0 exposes those via address conventions on top.

##### Why
The single most common interview misstep is conflating the two: "AMQP 1.0 is just AMQP 2.0" (false — different protocol) or "AMQP 0.9.1 is deprecated" (false — still the default in RabbitMQ). A senior engineer should be able to articulate the *real* differences and pick deliberately.

##### How
The protocol differences that actually matter:

| Dimension | AMQP 0.9.1 | AMQP 1.0 |
|---|---|---|
| **Model** | Broker-centric (exchange/queue/binding in protocol) | Peer-to-peer / link-oriented (no exchanges in protocol) |
| **Connection model** | Connection → Channel | Connection → Session → Link |
| **Flow control** | `prefetch` (a hack on top of the protocol) | Credit-based (first-class, sender + receiver negotiate credits) |
| **Acks / settlement** | `basicAck` / `basicNack` / `basicReject` (binary) | Disposition frames: `accepted`, `rejected`, `released`, `modified` |
| **Delivery semantics** | At-most / at-least-once via ack mode | First-class **settlement modes** at the link layer (incl. exactly-once via 2PC-style settlement) |
| **Message format** | Properties bag + opaque body | Standard sections: `header`, `properties`, `application-properties`, `body`, `footer` — cross-broker portable |
| **Symmetry** | Client → server | Symmetric (either side can initiate) |
| **Standardization** | RabbitMQ-driven, no formal body | OASIS / ISO standard |

The big conceptual upgrade in 1.0 is **credit-based flow control**: the receiver explicitly grants N credits to the sender's link, the sender transfers up to N messages, the receiver replenishes. This replaces 0.9.1's `prefetch` workaround with a protocol-level mechanism.

##### When
The honest answer is "what does your client ecosystem speak today?" — not "what's the newer standard?" Two greenfield projects, two different eras, same conclusion:

**GeoQ (2017, Node.js + RabbitMQ 3.6/3.7).** AMQP 1.0 on RabbitMQ existed only as the experimental `rabbitmq_amqp1_0` plugin. The Node.js 1.0 client story (`rhea`) was just emerging and had no production RabbitMQ adoption. `amqplib` (0.9.1-only) was the only mature option. **0.9.1 wasn't a choice — it was the only path that didn't mean fighting the entire ecosystem.**

**tai-portal (2025, .NET + RabbitMQ 4.x).** RabbitMQ 4.0 (Sept 2024) made 1.0 first-class, so 1.0 was *technically* viable. But the .NET RabbitMQ ecosystem — `RabbitMQ.Client`, MassTransit, EasyNetQ, NServiceBus — is still 0.9.1-first. AMQP 1.0 in .NET means `AMQPNetLite`, smaller community, fewer examples. For a RabbitMQ-only outbox pattern that already leans on broker-specific features (`x-death`, DLX, quorum queues), 1.0's portability sell doesn't pay off. **0.9.1 was the path of least resistance.**

The general decision rule:
- **Pick AMQP 1.0** when targeting **Azure Service Bus** (its native protocol — fighting it costs features) or **AWS MQ** (both ActiveMQ and Artemis versions support 1.0), or when cross-broker portability is a stated, funded requirement.
- **Pick AMQP 0.9.1** when staying inside the RabbitMQ + (`amqplib` / `pika` / `RabbitMQ.Client`) ecosystem. The tutorial corpus, plugin compatibility, and Stack Overflow coverage are overwhelmingly 0.9.1.

##### Trade-offs
- **0.9.1's broker-centric model** is the source of RabbitMQ's expressive routing (topic exchanges, bindings, headers exchange, native DLX). That's what makes RabbitMQ "smart broker." Giving that up to gain protocol portability is a real cost.
- **1.0's link/credit model** is technically superior (better flow control, standard message format, symmetric protocol) but the 1.0 client ecosystem outside of Azure Service Bus is thinner. <span style="color: #ffbb33; font-weight: bold;">"Use 1.0 for portability" works on paper but breaks down when broker-specific features (RabbitMQ exchanges, Service Bus topics + subscriptions) leak into your address conventions.</span>
- The rest of this document focuses on AMQP 0.9.1 because that's what tai-portal and GeoQ both use — chosen by ecosystem reality, not by ignoring 1.0. Where 1.0 differs materially, it's called out inline.

---

#### Mental Model (Smart Broker)

##### What
RabbitMQ is the prototypical "smart broker, dumb consumer" implementation. The broker takes responsibility for routing, retention, fan-out, and (with quorum queues) replicated durability. The consumer's job is "give me the next message off this queue."

##### Why
This is the inverse of <span style="color: #33b5e5; font-weight: bold;">Kafka</span>'s model where the broker is "dumb" (an ordered append-only log) and the consumer manages offsets. The trade-off matters: smart-broker semantics make routing declarative and inspectable; dumb-broker semantics push that complexity to the consumer in exchange for replay and massive throughput.

##### How
The mental model in five 0.9.1 entities:
- **Connection** — one TCP socket. Expensive to create (~tens of ms with TLS).
- **Channel** — a logical session multiplexed over a connection. Cheap. All operations (publish, declare, ack) happen on a channel.
- **Exchange** — routing decision-maker. Receives messages, looks at bindings, decides which queues get a copy.
- **Queue** — FIFO buffer with extra rules. Stores messages until a consumer acks them.
- **Binding** — `(queue, exchange, routing-key-pattern)` triple. The routing rule.

In AMQP 1.0 the equivalent abstraction is **nodes** (addressable endpoints — could back a queue, a topic, etc.) connected by **links**. RabbitMQ 4.x maps 1.0 addresses like `/exchanges/portal.events/security.privilege-change` to its 0.9.1 internals, so the smart-broker semantics survive even when you speak 1.0.

##### When
Use the smart-broker model when routing is non-trivial and consumers want filtered slices. Push routing into the broker config rather than the producer code — the broker is the inspectable, declarative source of truth.

##### Trade-offs
The smart-broker model means routing logic lives in broker config (exchanges, bindings, policies). On the upside that's declarative and inspectable in the management UI. On the downside, <span style="color: #ff4444; font-weight: bold;">topology drift</span> is a real operational hazard — if a producer expects an exchange to exist but ops never declared it, you get silent message loss until somebody notices the drop.

---

#### Connection vs Channel (vs Session/Link in 1.0)

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

**MassTransit 8 equivalent (.NET 9, 2026).** The connection / channel ceremony disappears — MassTransit owns the `IConnection` and channel pool internally. You wire the bus once at startup and inject `IPublishEndpoint` / `IBus` everywhere:

```csharp
// Program.cs
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host(builder.Configuration["Rabbit:Host"], "/", h => {
            h.Username("portal-api");
            h.Password(builder.Configuration["Rabbit:Password"]);
        });
        cfg.ConfigureEndpoints(ctx);   // auto-creates exchanges + queues by message type
    });
});

// Anywhere that publishes:
public class PrivilegeService(IPublishEndpoint bus)
{
    public Task GrantAsync(PrivilegeChangeEvent evt) => bus.Publish(evt);
}
```

MassTransit derives the exchange name from the message type (`PrivilegeChangeEvent` → `Portal.Events:PrivilegeChangeEvent`), enables publisher confirms by default in 8.x, and pools channels per consumer-thread.

**AWS equivalent (SNS+SQS, AWS SDK v3 for Node.js, 2026).** No connections, no channels — every operation is an HTTPS call via the SDK. The "exchange" becomes an SNS topic; "queues" are SQS queues subscribed to the topic.

```javascript
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Initialize once (client is connection-pool-aware)
const sns = new SNSClient({ region: 'us-east-1' });

// Publish — replaces channel.publish
await sns.send(new PublishCommand({
  TopicArn: process.env.TRACKING_EVENTS_TOPIC_ARN,
  Message: JSON.stringify(payload),
  MessageAttributes: {
    tenant:    { DataType: 'String', StringValue: tenant },
    assetType: { DataType: 'String', StringValue: assetType },
    event:     { DataType: 'String', StringValue: 'ping' },
  },
}));
```

The SDK handles HTTP keep-alive, retry with exponential backoff, and credential refresh. The "topology" (topic, queues, subscription filters) lives in Terraform / CDK, not the application code.

**AMQP 1.0 equivalent.** The connection model gains a layer: **Connection → Session → Link**.
- **Session** — an in-order context for sending and receiving messages. Roughly the 1.0 analogue of a 0.9.1 channel but with explicit ordering guarantees.
- **Link** — a one-way attachment to a node. A producer attaches a *sending link*; a consumer attaches a *receiving link*. Each link has its own credit window for flow control.

In practical .NET terms with `AMQPNetLite`:

```csharp
// RabbitMQ 4.x — address format maps to exchange/queue
var sender = new SenderLink(session, "publisher-link",
  "/exchanges/portal.events/security.privilege-change");
await sender.SendAsync(new Message("payload"));

// AWS MQ Artemis — JMS-style addressing (different!)
var awsSender = new SenderLink(session, "publisher-link",
  "my-queue-name");  // Direct queue name, no exchange prefix

// Azure Service Bus — hierarchical path
var sbSender = new SenderLink(session, "publisher-link",
  "orders/topcriptions/processor");  // Topic/Subscription path
```

The address format varies by broker:
- **RabbitMQ 4.x**: `/exchanges/{exchange}/{routing-key}` — maps to topic exchange + routing key
- **AWS MQ Artemis**: Just the queue name (e.g., `DLQ`, `orders`) — follows JMS conventions
- **Azure Service Bus**: `topic-name/Subscriptions/sub-name` — hierarchical paths

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

**MassTransit 8 equivalent.** No explicit `ExchangeDeclare` — MassTransit creates a fanout exchange per message type by default, with a topic exchange in front for routing-key-based filtering when configured:
```csharp
// Producer side — exchange is created on first Publish
await bus.Publish<PrivilegeChangeEvent>(new { UserId = id, NewRole = role });

// Consumer side — bind by message type via ConfigureEndpoints
cfg.ReceiveEndpoint("docviewer-privilege-sync", e =>
{
    e.ConfigureConsumer<PrivilegeChangeConsumer>(ctx);
    // Bind to the exchange MassTransit created for PrivilegeChangeEvent — implicit
});
```
For RabbitMQ-specific topic routing keys (when you want pattern subscriptions like `security.#`), use `cfg.Message<T>(m => m.SetEntityName("portal.events"))` and bind explicitly. Most teams skip the routing-key gymnastics and let MassTransit's per-type exchange model do the work.

**AWS equivalent (SNS+SQS).** SNS topic + filter policies on each SQS subscription replace the "topic exchange + binding pattern" model:
```hcl
# Terraform
resource "aws_sns_topic" "portal_events" {
  name = "portal-events"
}

resource "aws_sqs_queue" "docviewer_privilege_sync" {
  name = "docviewer-privilege-sync"
}

resource "aws_sns_topic_subscription" "docviewer" {
  topic_arn = aws_sns_topic.portal_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.docviewer_privilege_sync.arn
  filter_policy = jsonencode({
    "event-type": [{ "prefix": "security.privilege-" }]   # ~ topic key wildcard
  })
}
```
SNS filter policies handle prefix / suffix / numeric / IP / "anything-but" matches but no `*`/`#` semantics — you encode dimensions as message attributes (`event-type`, `tenant`, etc.) and filter on those, not on a single `routing-key` string.

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

**MassTransit equivalent.** Fanout-to-many-instances is `Publish<T>()` plus per-instance temporary endpoints — MassTransit creates auto-delete queues for instance-specific subscribers automatically:
```csharp
// Each web instance at startup
cfg.ReceiveEndpoint($"tile-cache.invalidate.{Environment.MachineName}", e =>
{
    e.AutoDelete = true;
    e.Durable    = false;
    e.ConfigureConsumer<TileCacheInvalidationConsumer>(ctx);
});
```
Or use **bus instance endpoints** (`cfg.AddConsumer<...>().Endpoint(e => e.InstanceId = ...)`) which is the idiomatic MT 8 way to do "every instance gets a copy."

**AWS equivalent.** SNS to multiple SQS queues, *one queue per consumer instance* — but in practice on AWS you'd avoid per-instance SQS queues (cost + topology churn) and instead use:
- **SNS HTTP/HTTPS subscriptions** — each web instance registers its own HTTPS endpoint on startup and unsubscribes on shutdown. Push-based, no queue needed.
- **DynamoDB Streams** or **EventBridge** with cross-instance dispatch via WebSocket.
- For 2026 greenfield: **AWS AppSync** or a Pub/Sub layer over WebSockets often beats the SNS-per-instance pattern.

The "exclusive auto-delete queue per instance" model is a RabbitMQ idiom that doesn't translate cleanly to AWS — the AWS-native pattern for this is **push to instances**, not **queue per instance**.

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

**MassTransit equivalent.** Queue properties are receive-endpoint config; quorum and DLQ are first-class:
```csharp
cfg.ReceiveEndpoint("tracking.ingest", e =>
{
    e.SetQuorumQueue(replicationFactor: 3);
    e.SetMessageTimeToLive(TimeSpan.FromHours(24));
    e.BindDeadLetterQueue("tracking.dead");
    e.Bind("tracking.events", x => x.RoutingKey = "tracking.*.*.ping");
    e.ConfigureConsumer<IngestConsumer>(ctx);
});
```

**AWS equivalent (SQS).** TTL becomes `MessageRetentionPeriod`; DLX becomes a `RedrivePolicy` pointing at another SQS queue; "quorum" is implicit — SQS is multi-AZ replicated by default:
```hcl
resource "aws_sqs_queue" "tracking_ingest_dlq" {
  name                       = "tracking-ingest-dlq"
  message_retention_seconds  = 14 * 24 * 3600   # 14 days max
}

resource "aws_sqs_queue" "tracking_ingest" {
  name                       = "tracking-ingest"
  message_retention_seconds  = 24 * 3600        # 24h, like x-message-ttl
  visibility_timeout_seconds = 60               # ~ ack deadline
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tracking_ingest_dlq.arn
    maxReceiveCount     = 5                     # ~ 5 retries then DLQ
  })
}
```
Note SQS has no concept of "binding by routing-key pattern" — the SNS topic + filter policy on the subscription does that work.

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

**MassTransit equivalent.** Publisher confirms are **on by default** in MassTransit 8.x — `await bus.Publish(evt)` only completes after the broker confirms. Async batch confirms are also handled internally; you tune via `cfg.ConfigureBatchPublish(b => b.Enabled = true; b.MessageLimit = 100)`. No explicit `ConfirmSelect` / `WaitForConfirms` ever appears in app code.

**AWS equivalent.** SQS / SNS use HTTP — the SDK call's response IS the confirmation. `await sqs.send(new SendMessageCommand(...))` returning a `MessageId` means the service has the message durably (3-AZ replicated). No separate confirm protocol; failure surfaces as a thrown exception.

```typescript
const result = await sqs.send(new SendMessageCommand({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify(payload),
}));
// result.MessageId is set => SQS has the message in 3 AZs. No further confirm needed.
```
For batched throughput use `SendMessageBatchCommand` (10 messages per call, all confirmed in one response).

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

**MassTransit equivalent.** Batch publish is config, not code:
```csharp
cfg.ConfigureBatchPublish(b => {
    b.Enabled = true;
    b.MessageLimit = 100;             // flush at 100 msgs
    b.SizeLimit    = 256 * 1024;      // or 256 KB
    b.Timeout      = TimeSpan.FromMilliseconds(50);
});
```
`bus.Publish(...)` returns a Task that completes when the batch flushes and the broker confirms. No deliveryTag bookkeeping in app code.

**AWS equivalent.** `SendMessageBatchCommand` accepts up to 10 messages per call, all confirmed in one HTTP round-trip. For higher rates, fan out across multiple producer processes — SQS scales effectively unlimited on the receive side, throughput per producer is HTTP-bound.
```typescript
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
const result = await sqs.send(new SendMessageBatchCommand({
  QueueUrl: queueUrl,
  Entries: pings.slice(0, 10).map((ping, i) => ({
    Id: String(i),
    MessageBody: JSON.stringify(ping),
  })),
}));
// result.Successful and result.Failed are populated per-message
```

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

**MassTransit equivalent.** Durability is on by default for both exchange and message; quorum queues opt-in:
```csharp
cfg.ReceiveEndpoint("tracking.ingest", e =>
{
    e.SetQuorumQueue(replicationFactor: 3);   // durable + Raft-replicated
    e.Durable = true;                         // queue survives restart (default)
    // Messages are persistent by default; override per send via SendContext.Durable = false
});
```

**AWS equivalent.** Durability is **not configurable** on SQS or SNS — both are 3-AZ replicated by default. The 0.9.1 "three flag combo" collapses to "use a Standard or FIFO queue and you're done." The trade-off shows up in **price** (SNS $0.50/M, SQS $0.40/M) and **delivery semantics** (Standard SQS = at-least-once, FIFO SQS = exactly-once *with* a 300 TPS limit per group ID, raisable to 70k with high-throughput mode).

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

**MassTransit equivalent.** No TTL+DLX queue chain — MassTransit composes immediate retries (in-process), delayed redelivery (scheduler-backed), and a DLQ as endpoint config. The whole machinery is one block:
```csharp
cfg.ReceiveEndpoint("tracking.enrich", e =>
{
    // Immediate retries — fast transient errors (DB blip, network)
    e.UseMessageRetry(r => r.Exponential(
        retryLimit: 3, minInterval: TimeSpan.FromMilliseconds(100),
        maxInterval: TimeSpan.FromSeconds(2), intervalDelta: TimeSpan.FromMilliseconds(200)));

    // Delayed redelivery — slower waits between retry tiers (uses RabbitMQ delayed-msg plugin or scheduler)
    e.UseDelayedRedelivery(r => r.Intervals(
        TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(5), TimeSpan.FromHours(1)));

    // Anything still failing after all retries lands in tracking.enrich_error / tracking.enrich_skipped
    e.ConfigureConsumer<EnrichConsumer>(ctx);
});
```
MassTransit auto-creates `<endpoint>_error` (faulted messages) and `<endpoint>_skipped` (unhandled message types) queues — these are the DLQs. No `x-death` header parsing in app code.

**AWS equivalent (SQS).** SQS retry is the queue's `visibility_timeout` + `maxReceiveCount`, not a TTL+DLX chain. Delayed retries need a separate queue per tier (or Step Functions for richer backoff):
```hcl
# Three retry tiers, each with its own queue and delivery delay
resource "aws_sqs_queue" "tracking_enrich" {
  name                       = "tracking-enrich"
  visibility_timeout_seconds = 300                       # ack deadline = "implicit retry interval"
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tracking_enrich_retry_30s.arn
    maxReceiveCount     = 3                              # 3 in-place attempts then move
  })
}

resource "aws_sqs_queue" "tracking_enrich_retry_30s" {
  name                = "tracking-enrich-retry-30s"
  delay_seconds       = 30                               # ~ x-message-ttl on the wait queue
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.tracking_enrich.arn]
  })
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tracking_enrich_retry_5m.arn
    maxReceiveCount     = 3
  })
}
# ...further tiers + permanent DLQ omitted
```
For richer scheduling (exponential, jittered), the 2026 idiom is **AWS Step Functions** with `Wait` states between Lambda invocations — it gives observable retry-history per execution, which the queue-tier approach doesn't.

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

**MassTransit equivalent.** Prefetch + consumer count are endpoint-level config; competing consumers means scaling the process count (Kubernetes replicas) — MassTransit handles channel/connection sharing within each process:
```csharp
cfg.ReceiveEndpoint("tracking.enrich", e =>
{
    e.PrefetchCount = 4;
    e.ConcurrentMessageLimit = 4;          // max in-flight per consumer
    e.ConfigureConsumer<EnrichConsumer>(ctx);
});
```

**AWS equivalent.** SQS competing consumers is the long-poll model — N workers each call `ReceiveMessage` with `WaitTimeSeconds: 20`, SQS only delivers each message to one of them at a time (controlled by `visibility_timeout`):
```typescript
// enrich-worker.ts (run as N replicas)
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
const sqs = new SQSClient({ region: 'us-east-1' });

while (true) {
  const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: process.env.ENRICH_QUEUE_URL,
    MaxNumberOfMessages: 10,             // ~ prefetch
    WaitTimeSeconds: 20,                 // long poll
  }));
  await Promise.all(Messages.map(async (msg) => {
    try {
      await mapMatchAgainstRoadGeometry(JSON.parse(msg.Body!));
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: process.env.ENRICH_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      }));
    } catch { /* leave message; visibility timeout expires → redelivery */ }
  }));
}
```
For 2026 greenfield, **Lambda + SQS event source mapping** removes the polling loop entirely — Lambda manages the receive/delete cycle and scales out to handle queue depth automatically.

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

**MassTransit equivalent.** "One subscriber per process instance" uses MT's instance endpoints — generated names with auto-delete + non-durable so they vanish on shutdown:
```csharp
// Producer (anywhere)
await bus.Publish(new TileCacheInvalidated { Key = "tile:42:hash" });

// Each web instance in Program.cs
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<TileCacheInvalidationConsumer>();
    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host(...);
        cfg.ReceiveEndpoint(
            new TemporaryEndpointDefinition(),     // generates unique queue name per instance
            e => e.ConfigureConsumer<TileCacheInvalidationConsumer>(ctx));
    });
});
```

**AWS equivalent.** SNS → multiple SQS subscribers is the canonical AWS pub/sub pattern, but the "ephemeral per-instance queue" model is awkward on AWS (queues cost money + subscribe/unsubscribe churn). Better fit:
```typescript
// 2026-idiomatic: SNS HTTP/HTTPS subscription per instance, registered on startup
import { SNSClient, SubscribeCommand, UnsubscribeCommand } from '@aws-sdk/client-sns';
const sns = new SNSClient({ region: 'us-east-1' });

const { SubscriptionArn } = await sns.send(new SubscribeCommand({
  TopicArn: process.env.TILE_CACHE_INVALIDATE_TOPIC_ARN,
  Protocol: 'https',
  Endpoint: `https://${process.env.MY_HOSTNAME}/internal/cache-invalidate`,
}));

process.on('SIGTERM', () =>
  sns.send(new UnsubscribeCommand({ SubscriptionArn })));
```
For browser-facing fanout, **AWS AppSync subscriptions** (GraphQL over WebSocket) or **API Gateway WebSocket APIs** are the typical 2026 picks — they handle the per-connection state AWS SQS doesn't.

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

##### How GeoQ used the five microservices messaging patterns

A typical mid-2010s Node.js microservices stack reaches for RabbitMQ for five distinct jobs. GeoQ used all five:

**1. Command / task queues (competing consumers).**
The `tracking.enrich` and `tracking.archive` queues each had 8-16 worker processes consuming in parallel. Broker round-robins messages across them; horizontal scale = `kubectl scale deployment enrich-worker --replicas=24`. No coordination, no leader election — RabbitMQ's at-least-once + manual ack gives "exactly one worker handles each message at a time" for free.
```javascript
// enrich-worker.js
await channel.prefetch(4);
await channel.consume('tracking.enrich', async (msg) => {
  try {
    await mapMatchAgainstRoadGeometry(JSON.parse(msg.content));
    channel.ack(msg);
  } catch (err) {
    channel.nack(msg, false, false);  // → DLX with retry-count
  }
});
```

*MassTransit equivalent:*
```csharp
public class EnrichConsumer : IConsumer<TrackingPing>
{
    public async Task Consume(ConsumeContext<TrackingPing> ctx)
    {
        await mapMatcher.MatchAsync(ctx.Message);
        // Throw to trigger UseMessageRetry → UseDelayedRedelivery → _error queue
    }
}
// In Program.cs
cfg.ReceiveEndpoint("tracking.enrich", e =>
{
    e.PrefetchCount = 4;
    e.ConcurrentMessageLimit = 4;
    e.UseMessageRetry(r => r.Immediate(3));
    e.ConfigureConsumer<EnrichConsumer>(ctx);
});
```

*AWS equivalent (SQS + Lambda — 2026 idiomatic):*
```typescript
// AWS Lambda handler — SQS event source mapping handles polling, batching, retry
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchItemFailure[] = [];
  await Promise.all(event.Records.map(async (record) => {
    try {
      await mapMatchAgainstRoadGeometry(JSON.parse(record.body));
    } catch {
      failures.push({ itemIdentifier: record.messageId });  // partial-batch failure
    }
  }));
  return { batchItemFailures: failures };  // failed items return to queue → retry → DLQ
};
```
Lambda + SQS event source handles concurrency, scaling (up to `ReservedConcurrency`), and retry-then-DLQ via `maxReceiveCount`. No `kubectl scale` needed.

**2. Event bus (topic exchange for pub/sub between services).**
`tracking.events` was the integration backbone. Producers (HTTP gateway, GPS device adapter) didn't know who consumed. Subscribers added themselves with binding patterns:
- `live-dashboard-acme` bound `tracking.acme.#` (one tenant, all asset types)
- `fleet-analytics` bound `tracking.*.fleet-truck.ping` (all tenants, fleet trucks only)
- `compliance-archive` bound `tracking.#` (everything, durable, no TTL)

Adding a new consumer (e.g., a real-time geofence-alert service) was a deployment + binding declaration — zero producer changes. **This is the canonical "smart broker" win** for microservices: routing config is data in the broker, not code in the publisher.

**3. Saga orchestration (request/reply via reply-to).**
GeoQ used this sparingly, but one place it earned its keep was **trip-end reconciliation**. When an enrichment worker hit an unknown road segment, it published a request to `geo-service.lookup` with `replyTo: <ephemeral-queue>` and `correlationId: <uuid>`. The geo-service consumed, looked up the segment in PostGIS, and replied to the ephemeral queue. The enrich worker awaited the response with a 5s timeout.
```javascript
const replyQ = await channel.assertQueue('', { exclusive: true });
const correlationId = uuid();
const result = new Promise((resolve, reject) => {
  channel.consume(replyQ.queue, (msg) => {
    if (msg.properties.correlationId === correlationId) {
      resolve(JSON.parse(msg.content));
    }
  }, { noAck: true });
});
channel.publish('geo.lookup', 'segment.find', payload, {
  replyTo: replyQ.queue, correlationId,
});
```
**We mostly regretted it.** RPC-over-broker is debug-hostile (no correlation in HTTP traces), and we eventually replaced most of it with direct HTTP. Kept it only for the geo-service because it sat behind a firewall the enrichment workers couldn't reach directly.

*MassTransit equivalent — `IRequestClient<T>`:*
```csharp
public class EnrichConsumer(IRequestClient<SegmentLookup> client) : IConsumer<TrackingPing>
{
    public async Task Consume(ConsumeContext<TrackingPing> ctx)
    {
        var response = await client.GetResponse<SegmentLookupResult>(
            new SegmentLookup { Lat = ctx.Message.Lat, Lng = ctx.Message.Lng },
            timeout: TimeSpan.FromSeconds(5));
        // ... use response.Message
    }
}
```
MassTransit handles the reply-queue lifecycle, correlation ID, and timeout. Same fundamental debuggability issues, but at least the boilerplate is gone.

*AWS equivalent.* AWS doesn't have first-class request/reply over a broker. Three idiomatic alternatives in 2026:
1. **Direct HTTP to API Gateway / ALB** — what GeoQ should have done. No broker hop.
2. **Step Functions Synchronous Express Workflow** — invoke a state machine that fans out, waits for a callback token, returns the result. Best when work needs orchestration.
3. **EventBridge + correlation ID** — publish request, consumer publishes reply, requester polls a DynamoDB row keyed on correlation ID. Awkward; the answer is usually #1.

The lesson generalizes: **request/reply over a broker is rarely the right pattern in 2026**. Use HTTP for sync; use events + state machines for async coordination.

**4. Cache invalidation fanout.**
GeoQ's web tier (Hapi.js dashboards) cached rendered map tiles in per-instance memory. When the road-geometry service published an update, every web instance had to evict matching tiles. Pattern:
- Exchange: `cache.invalidations` (fanout, durable)
- Each web instance declared an **exclusive auto-delete queue** at startup, bound to the fanout
- On instance shutdown: queue auto-deleted (no leaked queues)
- On a publish to `cache.invalidations`, every instance got a copy and evicted the matching keys from its local LRU + Redis

This is the textbook fanout use case — every consumer wants every message, and the consumer set is dynamic.

**5. Async I/O offloading (long-running work behind a fast HTTP response).**
Two big examples:
- **Third-party fleet webhook ingest.** Verizon Connect / Geotab pushed batched ping bundles via HTTP webhook. Bundle parsing + per-ping enrichment took 2-30 seconds. We couldn't hold the webhook open that long (third-party retry storms on timeout). Pattern: Hapi handler validated the signature, published the raw bundle to `tracking.ingest.bundles`, returned 200 in <50ms. A bundle-splitter consumer then republished individual pings to `tracking.events`.
- **CSV bulk import.** Customers uploaded 100k-row asset CSVs via the dashboard. The upload handler stored the file in S3, published one `import.start` message with the S3 key, returned 202 + a job ID. An import-worker streamed the CSV, batched 1k pings at a time, and updated MongoDB. Status polled via a separate `/jobs/{id}` endpoint.

Both follow the same shape: **HTTP responds in milliseconds with an acknowledgment, real work happens behind the broker.** This is where RabbitMQ paid for itself most clearly in 2017 microservices — Node.js single-threaded event loop made "do the work in the request handler" actively dangerous, and RabbitMQ gave us crash-safe async offload with zero infrastructure beyond the broker we already had.

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

##### How tai-portal uses (and will use) the five microservices messaging patterns

tai-portal is a modular monolith *evolving toward* microservices. The outbox pattern is the headline use case, but RabbitMQ does (or will do) the same five jobs GeoQ did — just at lower volume and with .NET ergonomics. Some are live in Stage 1B; some are designed-in extension points for Stages 2-3.

**1. Command / task queues (competing consumers).** *(Stage 1B — live)*
The outbox publisher itself is a competing-consumer pattern, just with PostgreSQL as the queue: multiple `OutboxPublisherBackgroundService` replicas can run side-by-side because the work-fetch query uses `SELECT FOR UPDATE SKIP LOCKED` (`OutboxPublisherBackgroundService.cs:86-93`). Each replica grabs a disjoint batch, no leader election needed.

When work moves *out* of PostgreSQL into RabbitMQ for downstream consumers (Stage 2), the same pattern applies on the broker side. For example, the planned `portal.notifications.email` queue will have N email-worker replicas, prefetch=10, sending via SendGrid; broker round-robins. Pure horizontal scale.

**2. Event bus (topic exchange for pub/sub between services).** *(Stage 1B — live producer; Stage 2 — consumers)*
`portal.events` (declared at `RabbitMqPublisher.cs:86-99`) is the integration backbone. The producer publishes `PrivilegeChangeEvent` → routing key `security.privilege-change`; consumers will subscribe with binding patterns:
- DocViewer's `docviewer.privilege-sync` queue: `security.privilege-change` (exact)
- Planned audit-warehouse worker: `security.#` (everything security-related, durable, no TTL)
- Planned admin-dashboard live feed: `#` (firehose, exclusive auto-delete per session)

The producer doesn't know any of these consumers exist. Adding a new subscriber (e.g., a SOC-2 compliance archive) is a binding declaration in the consumer app — zero portal-api changes. **Same "smart broker" win as GeoQ**, just at much lower message volume (~hundreds/min vs GeoQ's tens-of-thousands/sec).

**3. Saga orchestration (request/reply via reply-to).** *(Stage 3 — designed, not built)*
The borrower onboarding flow is the natural saga: privilege grant → identity verification (third-party KYC) → document generation → e-signature → loan-application creation. Each step is an independent service in the target architecture; failure of any step requires compensation (revoke privilege, re-issue documents).

The plan is **not** to use RabbitMQ request/reply for this — that would be the GeoQ mistake repeated. Instead, the saga is **choreographed via integration events**: each service publishes its outcome event (`KycVerified`, `KycFailed`, `DocumentsGenerated`, etc.), and a Saga coordinator (likely [MassTransit Saga state machine](https://masstransit.io/documentation/patterns/saga)) subscribes to all of them and tracks state per correlation ID. The `MessageId` and `CorrelationId` headers tai-portal already stamps on every outbox message are the dedup + saga-correlation keys.

The lesson from GeoQ: **RPC-over-broker is debug-hostile.** For sagas, choreography (events + state machine) beats orchestration (request/reply chains). RabbitMQ's role is the durable event delivery, not the synchronous coordination.

**4. Cache invalidation fanout.** *(Stage 2 — designed)*
The portal-api caches per-user privilege computations (rolling up role + entitlement + tenant overrides into a flat permission set) in Redis with a 15-min TTL. When an admin changes a user's entitlements, all in-flight sessions for that user need to invalidate their cached privilege view *immediately* — waiting 15 min for TTL is unacceptable for a permissions change.

Pattern (planned):
- New exchange: `portal.cache-invalidations` (fanout, durable)
- Each portal-api instance declares an exclusive auto-delete queue at startup, bound to the fanout
- On `PrivilegeChangeEvent` publish (already happening today), a small adapter republishes a cache-eviction message to `portal.cache-invalidations` with the affected user IDs
- Every portal-api instance receives it, evicts matching keys from its local IMemoryCache + Redis

This is the only fanout use case currently anticipated. It's a textbook fit: "every consumer wants every message, consumer set is dynamic."

**5. Async I/O offloading (long-running work behind a fast HTTP response).** *(Stage 2-3 — designed)*
Several portal-api endpoints have long-running work that today runs inline and will be offloaded:

- **Loan-document PDF generation.** `POST /loans/{id}/documents` currently builds a 30-page PDF synchronously (4-8 seconds via DinkToPdf). Plan: handler stages a `LoanDocumentRequested` event in the outbox, returns 202 + a job ID. A `pdf-worker` consumer generates the PDF, uploads to S3, publishes `LoanDocumentReady` (which a SignalR hub picks up and pushes to the borrower's UI).
- **Bulk privilege import.** Admin uploads a 5k-row CSV of role assignments. Today: synchronous loop, request times out around row 800. Plan: store CSV in S3, publish `PrivilegeBulkImportRequested`, return 202 + job ID. Worker processes in batches, writes per-row results to a `BulkImportResult` table for status polling.
- **Outbound webhook delivery.** Tenants register webhook endpoints for events they care about (`PrivilegeChangeEvent`, `LoanStatusChanged`, etc.). Delivery is async with retries — the webhook subscriber declares a queue bound to the relevant routing keys, and a delivery worker handles HTTP POSTs with exponential backoff (TTL+DLX retry chain).

All three follow the GeoQ pattern: **HTTP responds in milliseconds with an acknowledgment, real work happens behind the broker.** The outbox is the bridge — the API endpoint stages the work in the same DB transaction as the entity write, the worker drains it.

**The arc:** today, RabbitMQ in tai-portal is just one job (cross-app event publish via outbox). The architecture *deliberately* leaves space for the other four — `IIntegrationEventPublisher` is the swap point, the topic exchange is in place, the routing-key convention is established. Stages 2-3 are mostly "add a consumer" rather than "rewire the producer."

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

#### What's actually different between AMQP 0.9.1 and 1.0?
**Q:** Is AMQP 1.0 just "AMQP 2.0"? Should I be using it?
**A:** They're different protocols that share a name. 0.9.1 is broker-centric — exchanges, queues, bindings, and routing keys are baked into the protocol. 1.0 is peer-to-peer / link-oriented; there are no exchanges in the protocol — those are broker-side addressing conventions.

Three concrete differences worth knowing:
1. **Connection model.** 0.9.1: Connection → Channel. 1.0: Connection → Session → Link. A link is a one-way attachment to a node with its own credit window.
2. **Flow control.** 0.9.1 uses `prefetch` (a workaround on top of the protocol). 1.0 uses **credit-based flow control** at the link layer — the receiver explicitly grants N credits, the sender can transfer up to N messages, the receiver replenishes. First-class, no QoS hack needed.
3. **Settlement modes.** 0.9.1 has binary `ack` / `nack`. 1.0 has disposition frames (`accepted`, `rejected`, `released`, `modified`) and protocol-level settlement modes including 2PC-style exactly-once.

When to use each: 1.0 if you're targeting Azure Service Bus (its native protocol) or want broker portability; 0.9.1 if you're extending an existing RabbitMQ codebase or rely on RabbitMQ-specific 0.9.1 plugins.

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

#### When would you reach for AMQP 1.0?
**Q:** Greenfield Node.js worker that needs to talk to RabbitMQ. Use 0.9.1 or 1.0?
**A:** Two greenfield projects in my history, two different eras, same answer for both — and not because I ignored 1.0:

- **GeoQ (2017).** RabbitMQ 3.6/3.7 + Node.js. AMQP 1.0 on RabbitMQ was an experimental plugin; the Node.js 1.0 client (`rhea`) was just emerging. `amqplib` (0.9.1-only) was the only mature option. AWS MQ didn't exist yet (launched 2018). **1.0 wasn't a real choice — picking it would have meant fighting the ecosystem with no upside.**
- **tai-portal (2025).** RabbitMQ 4.0 made 1.0 first-class, so 1.0 was viable on the broker side. But the .NET RabbitMQ ecosystem — `RabbitMQ.Client`, MassTransit, EasyNetQ — is still 0.9.1-first. `AMQPNetLite` exists for 1.0 but has a smaller community. AWS MQ supports 1.0 on both ActiveMQ and Artemis backends but the managed offering's 1.0 support is newer and less documented than RabbitMQ-native workflows. And the outbox pattern leans on RabbitMQ-specific features (DLX, `x-death`, quorum queues) that don't get cleaner under 1.0. **0.9.1 was the path of least resistance.**

The decision rule generalizes:
- Default to 0.9.1 when staying inside the RabbitMQ ecosystem.
- Pick 1.0 when **the same code needs to talk to Azure Service Bus** (1.0 is its native protocol — fighting it loses features), **AWS MQ** (1.0 supported on both ActiveMQ and Artemis backends — AWS recently added 1.0 support), or when cross-broker portability is a stated, funded requirement (rare in practice), or when a specific 1.0 feature like **credit-based flow control** pays for itself because `prefetch` tuning has burned you.

For RabbitMQ-only deployments, 0.9.1 still gives you a richer ecosystem: more mature `amqplib` / `pika` / `RabbitMQ.Client`, better Stack Overflow coverage, full plugin compatibility (delayed-message exchange, consistent-hash exchange, federation upstream config). The protocol-level wins of 1.0 (link credits, structured message format) are real but usually don't justify giving up the ecosystem maturity unless you have a concrete pain point 0.9.1 caused you.

Starting a new microservice today targeting RabbitMQ? I'd still write `amqplib` 0.9.1 and revisit only if a portability requirement showed up. Starting a service targeting Service Bus? I'd write 1.0 from day one — fighting it is fighting the platform.

#### Protocol portability — is "AMQP everywhere" real?
**Q:** The pitch is "write once with AMQP 1.0, run on any broker." How real is that?
**A:** Partial. The wire protocol genuinely is portable — a 1.0 client can speak to RabbitMQ 4.x, Service Bus, Artemis, IBM MQ. The app-level realities that break the promise:

1. **Address conventions differ per broker.** RabbitMQ 1.0 addresses look like `/exchanges/portal.events/security.privilege-change`. Service Bus uses `topic-name/Subscriptions/sub-name`. AWS MQ (ActiveMQ Artemis backend) uses queue names directly like `DLQ` or `RetryQueue` — less structured than RabbitMQ but follows JMS naming. Artemis also supports the standard `$AMQ/queue/example` prefixed format. Your "broker-agnostic" code has a config block of broker-specific address strings.
2. **Topology management is broker-specific.** Declaring an exchange / topic / queue is not a 1.0 protocol operation — it's a broker-side admin concern. Each broker has its own management API (RabbitMQ HTTP API, Azure Service Bus namespace/topics via ARM, AWS MQ via boto3/SDK or console). Real portability requires terraforming this layer.
3. **DLQ and retry primitives differ.** RabbitMQ's DLX (`x-dead-letter-exchange`) is not a 1.0 concept. Azure Service Bus has its own DLQ semantics (`SubQueue.DeadLetter`). AWS MQ (ActiveMQ Artemis) uses JMS-style dead letter queues (DLQ) with configurable prefix (e.g., `ActiveMQ.DLQ`) and redelivery policies. Your "portable" retry handling probably isn't.
4. **Client library quality varies.** Azure SDK for Service Bus is excellent but Service Bus-specific. AWS SDK for .NET (`Amazon.MQ`) and Java (`amazon-mq`) provide managed broker access but the AMQP 1.0 story is less mature than the native RabbitMQ clients — AWS MQ's 1.0 support is newer (2024+) and the SDK documentation is RabbitMQ-centric. AMQPNetLite is cross-broker but lower-level. Apache Qpid Proton is the reference but its .NET binding is less polished than the broker-native options.

The honest answer: **AMQP 1.0 is a portable wire protocol, not a portable application-level abstraction.** If "broker portability" really matters, you abstract above the protocol — `IIntegrationEventPublisher` (the tai-portal pattern) or MassTransit. The 1.0 protocol's portability buys you the network layer for free; the application layer is still your problem.

The right mental model: AMQP 1.0 is to AMQP 0.9.1 as JDBC is to vendor-specific SQL — the wire / API is portable, but you'll still write code that assumes a specific dialect.

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
