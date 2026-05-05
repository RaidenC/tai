# Interview Reference Library

Canonical reference notes for technical interview preparation. Built from the tai-portal codebase (.NET 10 + Angular 21 + PostgreSQL) with real-world examples.

**33 notes** across 7 stages — ✨ = new or restructured in April 2026

## Topics (Interview Priority Order)

### Stage 1: Foundation
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[CSharp-Fundamentals]] | L1-L3 | ✅ Complete | C# language features, .NET fundamentals, error handling |
| [[Data-Structures-Algorithms]] | L1-Staff | ✨ Restructured | Arrays, Lists, Trees, Graphs, Big-O, BFS/DFS, DP, Sliding Window |
| [[Design-Patterns]] | L1-L3 | ✅ Complete | Creational, Structural, Behavioral patterns |
| [[TypeScript]] | L1-Staff | ✅ Complete | Structural typing, generics, utility types, discriminated unions |

### Stage 2: Backend
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[EFCore-SQL]] | L1-L3 | ✅ Complete | DbContext, Global Query Filters, xmin concurrency, domain events |
| [[LINQ]] | L1-Staff | ✅ Complete | IQueryable vs IEnumerable, deferred execution, expression trees |
| [[Async-Concurrency]] | L1-Staff | ✅ Complete | Async/await state machine, threading, parallelism, BackgroundService |
| [[MediatR-CQRS]] | L1-Staff | ✅ Complete | MediatR pipeline, Commands/Queries, FluentValidation, Domain Events |
| [[DDD-Domain-Modeling]] | L1-Staff | ✨ New | Entities, Value Objects, Aggregates, State Machines, Bounded Contexts |

### Stage 3: Frontend
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[Angular-Core]] | L1-L3 | ✅ Complete | DI, Signals, Standalone, Change Detection |
| [[Change-Detection-Signals]] | L1-Staff | ✨ New | Zone.js, zoneless Angular, OnPush, signals, effects, RxJS interop |
| [[Reactive-Forms-Custom-Controls]] | L1-Staff | ✨ New | Reactive forms, CVA, async validators, dynamic forms, form-state architecture |
| [[Performance-Core-Web-Vitals]] | L1-Staff | ✨ New | LCP, INP, CLS, lazy loading, code splitting, bundle analysis, virtual scrolling |
| [[Accessibility-WCAG-ARIA]] | L1-Staff | ✨ New | WCAG 2.2, ARIA patterns, focus management, screen-reader testing |
| [[Design-System-Architecture]] | L1-Staff | ✨ New | Token systems, theming, Storybook patterns, component API design |
| [[Storybook]] | L1-Staff | ✨ New | Storybook 8, Angular stories, interaction tests, a11y, CSP guardrails |
| [[RxJS-Signals]] | L1-L3 | ✅ Complete | Observables, Operators, Signals, toSignal() bridge, Store pattern |
| [[Frontend-Data-Structures]] | L1-Staff | ✨ New | JS Map/Set/WeakMap, Signals, Virtual Scroll, IndexedDB |

### Stage 4: Security
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[Authentication-Authorization]] | L1-L3 | ✅ Complete | OIDC, OAuth2, DPoP, Zero Trust |
| [[Security-CSP-DPoP]] | L1-L3 | ✅ Complete | CSP, DPoP, Trusted Types, security patterns |

### Stage 5: System
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[System-Design]] | L2-Staff | ✅ Complete | YARP Gateway, Multi-Tenancy, Middleware Pipeline, AI-Native Architecture |
| [[Distributed-Systems]] | L1-Staff | ✨ New | CAP, Consistency, Circuit Breaker, Saga, Outbox, Idempotency |
| [[API-Design]] | L1-Staff | ✨ New | REST, Richardson Model, Pagination, Problem Details, Idempotency Keys |
| [[Message-Queues]] | L2-Staff | ✅ Complete | RabbitMQ vs Kafka, Outbox, pgmq, managed brokers, MassTransit |
| [[Caching]] | L1-Staff | ✅ Complete | IMemoryCache, Redis, Output Caching, CDN, cache invalidation |
| [[SignalR-Realtime]] | L1-L3 | ✅ Complete | Hubs, Groups, Claim Check, BFF auth, NgZone optimization |
| [[OpenSearch]] | L2-L3 | ✅ Complete | Inverted Index, Sharding, Search Architecture |

### Stage 6: Operations
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[Logging-Observability]] | L1-Staff | ✅ Complete | Structured logging, Serilog, OpenTelemetry, CloudWatch |
| [[Testing-Backend]] | L1-Staff | ✨ Split | xUnit, Moq, WebApplicationFactory, Testcontainers, Respawn, Playwright, TDM |
| [[Testing-Frontend]] | L1-L3 | ✨ Split | Vitest, TestBed, HttpTestingController, Storybook, CSP compliance |
| [[CI-CD-DevOps]] | L1-Staff | ✨ New | Docker, CI Pipeline, Nx Affected, Blue-Green/Canary, Migration Safety |
| [[Performance-Optimization]] | L1-Staff | ✨ New | GC tuning, Span<T>, EXPLAIN ANALYZE, Core Web Vitals, Load Testing |
| [[Nx-Monorepo]] | L1-Staff | ✅ Complete | Nx 22 workspace, polyglot .NET+Angular, affected, module boundaries |

### Stage 7: Capstone
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[Full-System-Flow]] | Staff | ✅ Complete | Unified lifecycle diagram: auth → security → real-time → observability |

## Difficulty Levels

- **L1 (Junior):** Fundamental concepts, "what is X?"
- **L2 (Mid-Level):** Trade-offs, "when to use X vs Y?"
- **L3 (Senior):** Architecture, "how would you design X at scale?"
- **Staff:** System-wide design, "how would you architect this from scratch?"

## Usage

1. **Study:** Read TL;DR first, then dive into deep dive
2. **Practice:** Try answering Q&A without looking at answers
3. **Verify:** Check code links to see real implementations
4. **Connect:** Review cross-references to build mental model

## Export to Obsidian

Run the export script to get Obsidian-compatible files:

```bash
./scripts/export-obsidian.sh
```

This creates a copy in a format optimized for Obsidian (wiki-style links, appropriate frontmatter).

## Contributing

When adding new notes:
1. Copy `TEMPLATE.md` as your starting point
2. Fill in all sections with real examples from tai-portal
3. Include code links where the concept appears in the codebase
4. Add to this index with appropriate priority

---

*Last updated: 2026-05-05*
