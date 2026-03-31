# Knowledge System Decisions

**Date:** 2026-03-30
**Project:** tai-portal interview prep reference library

## Scope Decisions

### Output
- Location: `conductor/knowledge-base/reference/`
- Format: Markdown files (Obsidian-compatible)
- 11 topics total (one stage each)

### Template (per note)
Each reference note includes:
- Frontmatter (title, difficulty, lastUpdated, relatedTopics)
- TL;DR summary (30-second read)
- Deep Dive (theory + real-world examples from tai-portal)
- Interview Q&A (L1/L2/L3 difficulty levels)
- Cross-References (links to related topics)
- Code links (to actual implementation in tai-portal)

### Additional Features Accepted
1. ✅ Difficulty-tagged Q&A (L1/L2/L3) for every topic
2. ✅ Inline code links to real implementations in tai-portal
3. ✅ TL;DR summary at top of each note
4. ✅ Cross-reference matrix between topics
5. ✅ Obsidian export capability

### Structure Created
```
knowledge-base/reference/
├── TEMPLATE.md
├── index.md
├── csharp-fundamentals.md
├── data-structures-algorithms.md
├── design-patterns.md
├── efcore-sql.md
├── authentication-authorization.md
├── angular-core.md
├── rxjs-signals.md
├── signalr-realtime.md
├── security-csp-dpop.md
├── testing.md
└── nx-monorepo.md
```

## Staging Plan

| Stage | Topic | Status |
|-------|-------|--------|
| 1 | C# Fundamentals | ⏳ Pending |
| 2 | Data Structures & Algorithms | ⏳ Pending |
| 3 | Design Patterns | ⏳ Pending |
| 4 | EF Core & SQL | ⏳ Pending |
| 5 | Authentication & Authorization | ⏳ Pending |
| 6 | Angular Core | ⏳ Pending |
| 7 | RxJS & Signals | ⏳ Pending |
| 8 | SignalR & Real-Time | ⏳ Pending |
| 9 | Security (CSP, DPoP, Zero Trust) | ⏳ Pending |
| 10 | Testing | ⏳ Pending |
| 11 | Nx & Monorepo | ⏳ Pending |

## Branching Strategy

**Recommendation:** Direct commit to main (no PRs)

**Why:**
- Documentation only - no production code risk
- Personal learning project - no team review needed
- PR overhead not justified for reference notes
- Can always add tags/versions later if needed

If you want tracking: use git tags per stage:
```bash
git tag knowledge-stage-1-complete
```

## Next Step
Stage 1: C# Fundamentals