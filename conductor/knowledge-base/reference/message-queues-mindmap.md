---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 10
---
# 1. Message Queues & Event Streaming

## **1.1. Messaging Fundamentals**
1. Why Message Queues Exist
   - Decouples producers and consumers
   - Breaks temporal coupling
   - Handles slow or unreliable downstream operations
2. Event-Driven vs Event Sourcing
   - Event-Driven: DB is source of truth, events are transient notifications
   - Event Sourcing: Append-only log of events is the source of truth
3. The Transactional Outbox Pattern
   - Prevents network failures from rolling back DB transactions
   - Serializes events to an Outbox table in the same transaction
   - Background worker guarantees delivery to the broker
4. Logical vs Physical Replication
   - Shifts from physical disk copying to logical event replication
   - Consumers transform data into denormalized Read Models
   - Embraces Eventual Consistency
5. Lightweight Alternatives
   - System.Threading.Channels for in-memory queues
   - PostgreSQL pgmq for built-in durable queues

## **1.2. Broker Deep Dive**
1. RabbitMQ (The Smart Broker)
   - AMQP broker excelling at work distribution and complex routing
   - Deletes messages after consumer acknowledgment
   - Natively supports Dead-Letter Queues (DLQ)
2. Apache Kafka (The Event Streaming Platform)
   - Append-only distributed log
   - Retains messages for configured periods (enables replay)
   - Ideal for event sourcing and massive throughput (>100k events/sec)
3. RabbitMQ vs Kafka Comparison
   - RabbitMQ: Smart broker, dumb consumer (task queues)
   - Kafka: Dumb broker, smart consumer (event streaming)

## **1.3. Cloud Infrastructure**
1. Amazon MQ (Lift & Shift)
   - Managed RabbitMQ cluster
   - Zero code changes with MassTransit
   - Fixed hourly rate (costly for idle systems)
2. SNS + SQS (Serverless Standard)
   - AWS native pub/sub
   - Purely serverless and pay-per-request (~$0.40/million)
   - Most cost-effective for 95% of enterprise applications
3. CDC + EventBridge (Enterprise Standard)
   - Removes polling worker via Change Data Capture (AWS DMS)
   - Streams Outbox inserts directly to EventBridge
   - High baseline cost for 24/7 replication instance
4. Docker Simulation
   - Local testing via docker-compose
   - Uses PgBouncer for connection pooling and local RabbitMQ