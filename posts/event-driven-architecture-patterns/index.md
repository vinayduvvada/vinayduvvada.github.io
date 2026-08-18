# Event-Driven Architecture Patterns in Modern Cloud Systems

Event-driven architecture (EDA) has become the backbone of modern cloud-native applications. Instead of services calling each other directly, they communicate through events — decoupling producers from consumers and enabling massive scale.

## Why Event-Driven?

Traditional request/response systems create tight coupling. Service A calls Service B synchronously; if B is slow or down, A suffers. EDA flips this: A emits an event and moves on. Consumers process events independently, at their own pace.

This pattern was central to my work at Microsoft building the RAM (Release Analytics and Monitor) system for Windows releases, where thousands of package events needed to be processed, correlated, and surfaced in near-real-time without blocking upstream pipelines.

## Core Patterns

### 1. Pub/Sub (Publish-Subscribe)

The simplest form of EDA. Publishers emit events to a topic; subscribers receive all events on that topic.

- **AWS SNS + SQS fanout**: Fan a single event to multiple queues for parallel processing.
- **Azure Event Hub**: Partitioned log of events — consumers can replay from any offset.
- **Use case**: Broadcasting Windows package release status to multiple downstream risk engines.

### 2. Event Sourcing

Instead of storing current state, you store the full sequence of events that produced that state. The current state is derived by replaying events.

```
[OrderCreated] → [ItemAdded] → [PaymentProcessed] → [OrderShipped]
State = replay of all events
```

**Benefits**:
- Full audit trail — you always know *how* you got to the current state.
- Time-travel debugging — replay up to any point.
- Easy event-driven projections.

**Tradeoff**: Event stores grow large over time; snapshotting is needed for long-lived aggregates.

### 3. CQRS (Command Query Responsibility Segregation)

Separate the write model (commands that change state) from the read model (queries that read state). Often paired with event sourcing.

```
Write path: Command → Aggregate → Event → Event Store
Read path:  Event → Projection → Read Model → Query
```

This pattern powered the Windows release dashboard at Microsoft: writes came from automated test engines (commands), while the dashboard (read model) was a denormalized projection optimized for fast queries.

### 4. Saga Pattern

For distributed transactions spanning multiple services, Sagas coordinate a sequence of local transactions. Each step publishes an event; if a step fails, compensating transactions undo prior steps.

**Choreography-based Saga** (decentralized):
- Each service listens for events and decides what to do.
- Good for simple flows; hard to visualize complex ones.

**Orchestration-based Saga** (centralized):
- An orchestrator tells each service what to do and handles failures.
- Easier to reason about, but introduces a coordination bottleneck.

At ServiceNow, load balancer migration automation follows an orchestration-based saga: each migration step (drain, migrate, validate, enable) is coordinated by a workflow engine that handles rollback if any step fails.

## Event Broker Choices

| Broker | Throughput | Ordering | Replay | Best For |
|--------|-----------|---------|--------|----------|
| Kafka | Very High | Per-partition | Yes (log) | High-throughput streaming |
| AWS Kinesis | High | Per-shard | Yes (24h–7d) | AWS-native pipelines |
| Azure Event Hub | High | Per-partition | Yes | Azure-native streaming |
| RabbitMQ | Medium | Per-queue | Limited | Task queues, microservices |
| Google Pub/Sub | Very High | No guarantee | Yes (ACK-based) | GCP-native fanout |

## Practical Considerations

**Idempotency is non-negotiable.** Events can be delivered more than once (at-least-once delivery). Every consumer must handle duplicate events gracefully.

**Schema evolution matters.** Events are a public contract. Use schema registries (Confluent, AWS Glue) and backward-compatible evolution (adding fields, never removing).

**Dead-letter queues save you.** Always route failed events to a DLQ for inspection and replay rather than silently dropping them.

**Observability is harder.** A distributed event flow is harder to trace than a synchronous call chain. Distributed tracing (Jaeger, Zipkin, Azure App Insights) with correlation IDs across events is essential.

## When NOT to Use EDA

- Simple CRUD applications with no need for decoupling.
- When strong consistency is required (use synchronous transactions instead).
- When eventual consistency is not acceptable for the business domain.

## Conclusion

Event-driven architecture excels at decoupling, scale, and resilience. The key is choosing the right pattern — pub/sub for fanout, event sourcing for auditability, CQRS for read/write optimization, and sagas for distributed transactions. Layer these with solid idempotency, schema management, and observability, and you have a system built to scale.
