# Gemini CLI Prompt: Continue Interview Knowledge Base

Use this prompt with Gemini CLI to generate the remaining 10 reference notes for the interview prep knowledge base.

---

## Context

You are helping generate a comprehensive interview prep knowledge system for a full-stack developer (9 years Angular/.NET experience) who was laid off and is learning agentic AI. The notes should cover 11 topics with real examples from the tai-portal codebase (Nx monorepo with Angular + .NET 10).

## Output Location

All files go in: `conductor/knowledge-base/reference/`

## Template Structure

Each note must follow this exact structure (see TEMPLATE.md):

```markdown
---
title: {Topic Name}
difficulty: L1 | L2 | L3
lastUpdated: 2026-03-31
relatedTopics:
  - {Related Topic 1}
  - {Related Topic 2}
---

## TL;DR

{One-paragraph summary - 30 seconds max read}

## Deep Dive

### Concept Overview
{Explanation with enough detail for interviews. Use analogies.}

### Real-World Example (from tai-portal)
{Link to actual code in the repository}

```csharp
// or TypeScript/HTML/SQL depending on topic
// Actual code from tai-portal that demonstrates this concept
```

### Key Takeaways
- {Important point 1}
- {Important point 2}
- {Important point 3}

---

## Interview Q&A

### L1: {Fundamental Question}
**Difficulty:** L1 (Junior)
**Question:** {Common entry-level question}
**Answer:** {2-3 sentences max for L1}

---

### L2: {Applied Question}
**Difficulty:** L2 (Mid-Level)
**Question:** {Question requiring trade-offs or deeper knowledge}
**Answer:** {More detailed with alternatives comparison}

---

### L3: {Expert Question}
**Difficulty:** L3 (Senior)
**Question:** {Architecture, performance, edge cases}
**Answer:** {Comprehensive with diagrams or code examples}

---

## Cross-References
- [[{Related Topic 1}]] — {Why related}
- [[{Related Topic 2}]] — {Why related}

---

## Further Reading
- {Documentation link}
- {Blog post or article}
- {Source code in tai-portal}
```

## Difficulty Levels

- **L1 (Junior):** Fundamental concepts - "what is X?"
- **L2 (Mid-Level):** Trade-offs - "when to use X vs Y?"
- **L3 (Senior):** Architecture - "how would you design X at scale?"

## Topics to Generate (10 remaining)

Generate one note per topic. Follow the staging order:

1. **data-structures-algorithms.md** — Arrays, Lists, Trees, Graphs, Big-O, Hash Tables, Sorting algorithms
2. **design-patterns.md** — Creational (Factory, Builder, Singleton), Structural (Decorator, Adapter, Facade), Behavioral (Observer, Strategy, Repository)
3. **efcore-sql.md** — EF Core, migrations, LINQ queries, lazy loading, global query filters, performance
4. **authentication-authorization.md** — OIDC, OAuth2, DPoP, JWT, Zero Trust, claims-based auth
5. **angular-core.md** — DI, Lifecycle hooks, Components, Modules, Standalone components, Change detection
6. **rxjs-signals.md** — Observables, Operators, Angular Signals, RxJS vs Signals, async pipe
7. **signalr-realtime.md** — Hub connections, groups, streaming, reconnection, authentication
8. **security-csp-dpop.md** — Content Security Policy, DPoP tokens, XSS prevention, CORS, HTTPS
9. **testing.md** — Unit tests (Vitest/xUnit), Integration tests, E2E (Playwright), mocking, code coverage
10. **nx-monorepo.md** — Nx workspace, affected apps/libs, distributed caching, project references

## Code Examples

Find real examples in the tai-portal codebase:
- Backend: `apps/portal-api/` - .NET 8 controllers, services, EF Core
- Frontend: `apps/portal-web/src/app/features/` - Angular components
- Libraries: `libs/ui/design-system/`, `libs/core/domain/`, `libs/core/infrastructure/`

## Get Latest Documentation

> **NOTE:** Gemini CLI does NOT support MCP/Context7. Use web search instead.

Use standard web search to get latest library docs:

| Topic | Search Query |
|-------|--------------|
| C# / .NET | "C# 14 new features Microsoft Docs 2025 2026" |
| EF Core | "EF Core 8 9 new features Microsoft Docs 2025" |
| Angular | "Angular 18 19 new features 2025" |
| RxJS | "RxJS 7 8 operators documentation 2025" |
| SignalR | "ASP.NET Core SignalR tutorial 2025" |
| Nx | "Nx 19 20 monorepo tutorial 2025" |
| xUnit | "xUnit 3 testing .NET 8 tutorial 2025" |

**Before writing each Deep Dive section:**
1. Run a web search for latest documentation on that topic
2. Include the newest API/features in your answer
3. Note the version numbers (e.g., "Available since .NET 8 / Angular 18+")

Example:
```
Search: "Angular 19 signals new features 2025"
Then include: "Angular Signals were introduced in v16, stable in v17, with new features in v18/v19 like..."
```

---

## Alternative: Context7 (Claude Code only)

If using **Claude Code** instead of Gemini CLI, these Context7 library IDs provide the latest docs:

| Topic | Context7 Library ID |
|-------|---------------------|
| C# / .NET | `/websites/learn_microsoft_en-us_dotnet_csharp` |
| EF Core | `/dotnet/entityframework.docs` |
| Angular | `/websites/angular_dev` |
| RxJS | `/reactivex/rxjs` |
| NgRx Signals | `/websites/ngrx_io_guide_signals` |
| SignalR | `/websites/npmjs_package_microsoft_signalr` |
| Nx | `/websites/nx_dev` |
| xUnit | `/xunit/xunit.net` |

Example Context7 query:
```
Library: /websites/learn_microsoft_en_us_dotnet_csharp
Query: What are the latest C# 14 features?
```

## Completed Stage (Reference)

Stage 1 (csharp-fundamentals.md) is already complete with ~2000 lines, 11 deep dive sections, and L1/L2/L3 Q&A. Use it as a reference for depth and style.

## Instructions

1. Generate ONE topic at a time (to manage context window)
2. Use web search to get latest API details before writing each section
3. Find real code examples in tai-portal repository
4. Include practical interview questions with difficulty tags
5. Cross-reference with other topics where relevant
6. Write directly to `conductor/knowledge-base/reference/{topic-name}.md`
7. Update `conductor/knowledge-base/reference/index.md` to mark status as "✅ Complete"

## Start With

Begin with **Stage 2: Data Structures & Algorithms** (data-structures-algorithms.md)

---

*Prompt generated for Gemini CLI - 2026-03-31*