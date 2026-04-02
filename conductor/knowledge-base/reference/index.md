# Interview Reference Library

Canonical reference notes for technical interview preparation. Built from the tai-portal codebase with real-world examples.

## Topics (Interview Priority Order)

### Stage 1: Foundation
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[CSharp-Fundamentals]] | L1-L3 | ✅ Complete | C# language features, .NET fundamentals |
| [[Data-Structures-Algorithms]] | L1-L3 | ✅ Complete | Arrays, Lists, Trees, Graphs, Big-O |
| [[Design-Patterns]] | L1-L3 | ✅ Complete | Creational, Structural, Behavioral patterns |

### Stage 2: Backend
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[EFCore-SQL]] | L1-L3 | ✅ Complete | Entity Framework Core, migrations, queries |
| [[Authentication-Authorization]] | L1-L3 | ✅ Complete | OIDC, OAuth2, DPoP, Zero Trust |

### Stage 3: Frontend
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[Angular-Core]] | L1-L3 | ✅ Complete | DI, Signals, Standalone, Change Detection |
| [[RxJS-Signals]] | L1-L3 | ✅ Complete | Observables, Operators, Signals, toSignal() bridge, Store pattern |
| [[SignalR-Realtime]] | L1-L3 | ✅ Complete | Hubs, Groups, Claim Check, BFF auth, NgZone optimization |

### Stage 4: System
| Topic | Difficulty | Status | Description |
|-------|------------|--------|-------------|
| [[System-Design]] | L2-Staff | ✅ Complete | AI-Native architecture, Outbox, Sagas, Resilience |
| [[OpenSearch]] | L2-L3 | ✅ Complete | Inverted Index, Sharding, Search Architecture |
| [[Security-CSP-DPoP]] | L1-L3 | ✅ Complete | CSP, DPoP, Zero Trust, security patterns |
| [[Testing]] | L1-L3 | ⏳ Not Started | Unit, Integration, E2E testing patterns |
| [[Nx-Monorepo]] | L1-L3 | ⏳ Not Started | Nx workspace, monorepo patterns |

## Difficulty Levels

- **L1 (Junior):** Fundamental concepts, "what is X?"
- **L2 (Mid-Level):** Trade-offs, "when to use X vs Y?"
- **L3 (Senior):** Architecture, "how would you design X at scale?"

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

*Last updated: 2026-04-01*