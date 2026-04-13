# Knowledge Base Restructure Plan

> Generated: 2026-04-10
> Goal: Ensure every note stays within 3-4 concept groups, 3-7 points per group, forming a 3-4 level mindmap. Eliminate duplication. Fill interview gaps for senior/staff full-stack (.NET + Angular) roles.

---

## Phase 1: Resolve Overlap (Slim Existing Notes)

### 1a. `system-design.md` — Remove duplicated sections

Current state: 10 top-level concepts. Target: 4 concepts.

| Section | Action |
|---|---|
| 1. YARP Gateway | **Keep** |
| 2. CQRS with MediatR | **Remove** — duplicate of `mediatr-cqrs` |
| 3. Validation Pipeline | **Remove** — duplicate of `mediatr-cqrs` |
| 4. DDD — Rich Domain Model | **Extract** → new `ddd-domain-modeling` note (Phase 3) |
| 5. Multi-Tenancy | **Keep** |
| 6. Middleware Pipeline | **Keep** |
| 7. Domain Event Dispatch | **Remove** — duplicate of `mediatr-cqrs` |
| 8. Distributed Resilience | **Extract** → new `distributed-systems` note (Phase 3) |
| 9. AI-Native Architecture | **Keep** — merge with section 10 |
| 10. FinOps | **Merge** into section 9 as sub-point |

Result: `system-design` keeps 4 focused concepts:
1. Layered Architecture & YARP Gateway
2. Multi-Tenancy Strategy (3-layer isolation)
3. Middleware Pipeline Design
4. AI-Native Architecture & Cost-Aware Design

Add cross-references to `mediatr-cqrs`, `ddd-domain-modeling`, `distributed-systems`.

### 1b. `authentication-authorization.md` — Slim DPoP section

- Section 4 (DPoP) currently ~400 words duplicating `security-csp-dpop` section 3
- Replace with 2-3 sentence summary + cross-reference: "DPoP binds tokens to the client's cryptographic key — see [[Security-CSP-DPoP]] for the full mechanism."
- Keep sections 1-3, 5-6 as-is

### 1c. `efcore-sql.md` — Slim overlapping sections

- Section 2.1 (Domain Event Dispatch): Reduce to EF Core mechanics only (the `SaveChangesAsync` override pattern). Remove the full dispatch lifecycle explanation. Cross-ref `mediatr-cqrs`.
- Section 1.3 + 3.1 + 3.3 (Multi-tenancy): Keep EF-specific implementation (Global Query Filters config, TenantInterceptor code). Remove architectural discussion. Cross-ref `system-design` for the 3-layer strategy.

### 1d. `csharp-fundamentals.md` — Replace extracted sections with cross-refs

- Section 2.2 currently contains: "Async/Await Under the Hood", "LINQ & IQueryable vs IEnumerable", "IAsyncEnumerable"
- These all have dedicated notes now (`async-concurrency`, `linq`)
- Replace section 2.2 with a brief bridge paragraph + cross-references
- Reclaim the space to expand the Staff Q&A on `Span<T>` / zero-allocation patterns, or add error handling patterns (throw vs throw ex is there, but exception middleware, Result<T> pattern, etc. are missing)

### 1e. `design-patterns.md` — Slim architectural patterns section

- Section 4 (Architectural Patterns — Clean Architecture, CQRS, Repository) overlaps with `system-design` and `mediatr-cqrs`
- Slim to pattern descriptions only (~1 paragraph each). Cross-ref implementation notes.

---

## Phase 2: Split Oversized Notes

### 2a. `testing.md` → `testing-backend.md` + `testing-frontend.md`

**`testing-backend.md`** (3 concept groups):
1. Testing Foundations — Pyramid, AAA, Test Doubles (sections 1-3 of current note)
2. Backend Testing (.NET) — xUnit, Moq, WebApplicationFactory, Testcontainers/Respawn (sections 4-7)
3. E2E Testing — Playwright, TDM (sections 11-12)

**`testing-frontend.md`** (2 concept groups):
1. Frontend Testing (Angular) — Vitest, TestBed, HttpTestingController, Signal Store (sections 8-10)
2. Component Testing & CSP — Storybook, A11y guardrails, CSP custom components (sections 13-15)

Shared content: Both notes get a brief TL;DR of the testing pyramid for standalone readability, but the deep-dive lives in `testing-backend`.

Delete original `testing.md` and `testing-mindmap.md` after split. Create new mindmaps for each.

---

## Phase 3: Add New Notes (5 new topics)

### 3a. `ddd-domain-modeling.md` — Extracted from system-design

Concept groups:
1. **Core Building Blocks** — Entities vs Value Objects, Aggregates & Aggregate Roots, Strongly-Typed IDs
2. **Domain Behavior** — Rich vs Anemic Model, State Machines in Entities, Invariant Enforcement
3. **Domain Events** — Event lifecycle, Pre-save dispatch, Notification handlers, Event hierarchy
4. **Strategic DDD** — Bounded Contexts, Context Mapping, Module Boundaries (connects to Nx)

Source material: `system-design.md` section 4 + section 7, `mediatr-cqrs.md` section 3, `efcore-sql.md` domain event content. Consolidate the best explanation from each, eliminate the 3x duplication.

### 3b. `distributed-systems.md` — Reliability at scale

Concept groups:
1. **Consistency Models** — CAP theorem, Strong vs Eventual vs Causal consistency, Read-your-writes
2. **Resilience Patterns** — Circuit breaker (Polly), Retry with exponential backoff + jitter, Bulkhead isolation, Timeout
3. **Transaction Patterns** — Saga (choreography vs orchestration), Outbox pattern, Idempotent consumers, Compensating transactions
4. **Failure Modes** — Network partitions, Split brain, Cascading failures, Thundering herd

Source material: `system-design.md` section 8 (expand from "not implemented" stubs to full theory + trade-offs). `message-queues.md` outbox section provides implementation detail to cross-reference.

### 3c. `api-design.md` — REST API design

Concept groups:
1. **REST Principles** — Richardson Maturity Model, Resource naming, HTTP verbs & status codes, HATEOAS
2. **API Lifecycle** — Versioning strategies (URL vs header vs media type), Deprecation, OpenAPI/Swagger documentation
3. **Query Patterns** — Pagination (offset vs cursor/keyset), Filtering & sorting conventions, Sparse fieldsets, Bulk operations
4. **Reliability & Contracts** — Idempotency keys, RFC 9457 Problem Details (already used in tai-portal!), Rate limiting contracts, Content negotiation

### 3d. `ci-cd-devops.md` — Shipping code

Concept groups:
1. **Containerization** — Docker fundamentals, multi-stage builds, image optimization, Docker Compose for local dev
2. **CI Pipeline** — Build → Test → Lint → Security scan → Artifact, Nx affected for monorepo CI, Branch strategies
3. **Deployment Strategies** — Blue-green, Canary, Rolling, Feature flags, Database migration safety
4. **Infrastructure** — IaC concepts (CDK/Terraform), Environment parity (dev/staging/prod), Secrets management

### 3e. `performance-optimization.md` — Making it fast

Concept groups:
1. **Backend (.NET)** — GC generations & modes, `Span<T>` & zero-allocation, BenchmarkDotNet, memory pressure & `ArrayPool<T>`
2. **Database** — Query plan analysis (EXPLAIN ANALYZE), Index strategies, N+1 detection in production, Connection pooling (PgBouncer)
3. **Frontend** — Core Web Vitals (LCP, INP, CLS), Bundle analysis & tree shaking, Lazy loading strategy, Image optimization
4. **Methodology** — Profiling workflow (measure → hypothesize → fix → verify), Flame graphs, Load testing (k6/Artillery), Performance budgets

---

## Phase 4: Update Index and Cross-References

- Update `index.md` with new note names and stages
- Update `relatedTopics` frontmatter in all modified notes
- Create mindmap files for new notes
- Verify no broken `[[wiki-links]]` across the set

---

## Execution Order (recommended)

| Step | Action | Dependency |
|---|---|---|
| 1 | Slim `system-design.md` (Phase 1a) | None — biggest impact |
| 2 | Create `ddd-domain-modeling.md` (Phase 3a) | After step 1 (uses extracted content) |
| 3 | Create `distributed-systems.md` (Phase 3b) | After step 1 (uses extracted content) |
| 4 | Split `testing.md` (Phase 2a) | None |
| 5 | Slim `authentication-authorization.md` (Phase 1b) | None |
| 6 | Slim `efcore-sql.md` (Phase 1c) | After step 2 (cross-refs ddd note) |
| 7 | Slim `csharp-fundamentals.md` (Phase 1d) | None |
| 8 | Slim `design-patterns.md` (Phase 1e) | None |
| 9 | Create `api-design.md` (Phase 3c) | None |
| 10 | Create `ci-cd-devops.md` (Phase 3d) | None |
| 11 | Create `performance-optimization.md` (Phase 3e) | None |
| 12 | Update `index.md` and cross-references (Phase 4) | After all above |

---

## Final Note Inventory (26 notes)

| Stage | Notes |
|---|---|
| **Foundation** | `csharp-fundamentals`, `data-structures-algorithms`, `design-patterns`, `typescript` |
| **Backend** | `efcore-sql`, `linq`, `async-concurrency`, `mediatr-cqrs`, `ddd-domain-modeling` ✨ |
| **Frontend** | `angular-core`, `rxjs-signals` |
| **Security** | `authentication-authorization`, `security-csp-dpop` |
| **System** | `system-design`, `distributed-systems` ✨, `api-design` ✨, `message-queues`, `caching`, `signalr-realtime`, `opensearch` |
| **Operations** | `logging-observability`, `testing-backend` ✨, `testing-frontend` ✨, `ci-cd-devops` ✨, `performance-optimization` ✨, `nx-monorepo` |
| **Capstone** | `full-system-flow` |

✨ = new or split

---

## Topics Considered but Not Added

| Topic | Reason |
|---|---|
| `networking-http` | Can be covered as a section within `api-design` (HTTP fundamentals, `HttpClientFactory`) rather than standalone |
| `web-fundamentals` (browser internals) | Lower priority for .NET-heavy roles. Event loop basics can go in `angular-core` or `performance-optimization` frontend section |
| `cloud-architecture` (AWS/Azure) | `message-queues` already covers AWS messaging well. Full cloud coverage is too broad for one note and too role-dependent. Add if targeting cloud-heavy roles. |
| `accessibility` | Currently in Storybook testing section. Adequate for most interviews unless targeting a11y-focused roles. |
