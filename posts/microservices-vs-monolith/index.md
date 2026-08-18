# Microservices vs. Monolith: Choosing the Right Architecture

Few architectural debates generate more heat than microservices vs. monolith. The answer isn't universal — it depends on your team, domain, and scale. Having worked on both (a monolithic SaaS platform at ServiceNow and distributed microservice systems at Microsoft, Live Nation, and StubHub), here's an honest look at the tradeoffs.

## What Is a Monolith?

A monolith is a single deployable unit where all components — API handlers, business logic, data access — are packaged together. This doesn't mean a "big ball of mud." A well-structured monolith has internal module boundaries just as strict as service boundaries.

**Types**:
- **Modular monolith**: Internal modules with well-defined interfaces, single deployment.
- **Distributed monolith**: Multiple services deployed separately but tightly coupled — the worst of both worlds.

## What Are Microservices?

Microservices decompose an application into small, independently deployable services, each owning a bounded context and its own data store.

**Key principles**:
- Each service does one thing well.
- Services communicate via well-defined APIs (REST, gRPC, events).
- Each service has its own data store — no shared databases.
- Each service is independently deployable and scalable.

## The Real Tradeoffs

### Deployment Complexity

| | Monolith | Microservices |
|--|---------|--------------|
| Deployment | One artifact | N artifacts, N pipelines |
| Local dev | Simple | Requires orchestration (docker-compose, Kubernetes) |
| Debugging | Single log stream | Distributed tracing across services |
| Rollback | Single version | Version coordination across services |

At StubHub, deploying the integration platform via Mule ESB was straightforward as a monolithic application. Adding microservices required Jenkins pipelines for each service, PCF deployment coordination, and contract testing between services.

### Data Management

Microservices' biggest practical challenge: each service owns its data, but business operations often span multiple services. This forces you into:
- **Sagas** for distributed transactions.
- **Eventual consistency** as the default.
- **API composition** at query time (expensive).

Monoliths use a single ACID-compliant database — cross-domain queries are trivial JOINs.

### Scalability

Microservices let you scale hot components independently. At Live Nation (TicketWeb), we scaled the Kinesis-based event sharing module independently during high-traffic events without scaling the entire platform.

In a monolith, you scale the whole thing. For most applications this is fine — horizontal scaling of a well-designed monolith is surprisingly effective.

### Team Autonomy

Conway's Law: "Organizations design systems that mirror their communication structure."

Microservices align with team boundaries — each team owns a service end-to-end (code, deploy, operate). This reduces coordination overhead for large organizations.

For small teams, microservices create coordination overhead without the benefit. A team of 5 maintaining 15 services spends more time on service orchestration than product features.

## When to Choose a Monolith

- Early stage product — requirements change fast, split boundaries are premature.
- Small team (< 8 engineers).
- Domain boundaries are unclear — you haven't yet discovered where to draw service lines.
- Low operational maturity — you don't have CI/CD, observability, or container orchestration in place yet.

**The Strangler Fig pattern**: Start with a modular monolith, then peel off services along natural boundaries as the domain stabilizes and scale demands it.

## When to Choose Microservices

- Team scale > 30 engineers where team autonomy is needed.
- Different components have wildly different scaling needs.
- You have multiple independent release cadences.
- Strong operational maturity: containers, Kubernetes, service mesh, distributed tracing.
- Proven domain model — you know where your bounded contexts are.

## Migration Strategy: Monolith → Microservices

The most common migration path is the **Strangler Fig**:

1. **Identify** a bounded context with minimal external dependencies.
2. **Build** the new service alongside the monolith.
3. **Proxy** traffic to the new service via an API gateway.
4. **Deprecate** the monolith module once the new service is stable.
5. **Repeat** for the next boundary.

Avoid "big bang" rewrites — they fail. Move incrementally, one bounded context at a time.

## The Distributed Monolith Trap

The most dangerous outcome: you split into services but:
- Services share a database schema.
- Services call each other synchronously in long chains.
- You need to deploy multiple services together for any change.

This gives you all the complexity of microservices with none of the benefits. Watch for:
- Services that can't be deployed independently.
- Chatty inter-service communication in hot paths.
- Shared libraries that version-lock multiple services.

## Conclusion

Start simpler than you think you need. A well-structured modular monolith is a legitimate architecture for most products. Microservices add genuine value at organizational and scale boundaries that most teams never reach. When you do reach them, migrate incrementally using the Strangler Fig, not a rewrite.

The architecture should serve the team's ability to move fast safely — not the other way around.
