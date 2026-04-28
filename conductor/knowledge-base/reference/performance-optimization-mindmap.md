# Performance Optimization — Mindmap

## 1. Backend (.NET)
### 1.1 GC Generations & Server GC Mode
- **Generations**:
  - Gen 0: Short-lived (~85KB), frequent collection, ~1ms pause
  - Gen 1: Survived Gen 0, moderate collection, ~5ms pause
  - Gen 2: Long-lived, expensive, 10-100ms pause
  - LOH: Large objects (>85KB), expensive, no compaction
- **Server GC**: Per-core heaps, parallel collection, lower pause times
- **Trade-off**: Uses more memory (2-3x vs Workstation GC)

### 1.2 Span<T> & Zero-Allocation Patterns
- **Span<T>**: Stack-only, view into memory without copying
- **Memory<T>**: Heap-safe sibling, crosses await boundaries
- **ArrayPool**: Rent/return buffers instead of allocating
- **Use for**: Hot paths (parsing, serialization, tight loops)
- **Don't use everywhere**: Harder to read, only optimize hot paths

### 1.3 BenchmarkDotNet
- Micro-benchmarking library for .NET
- Measures: execution time, allocations, GC collections
- Accounts for JIT warmup, GC interference, statistical noise
- **Always measure before optimizing**

---

## 2. Database
### 2.1 Query Plan Analysis (EXPLAIN ANALYZE)
- Executes query and shows execution plan
- **Key metrics**:
  - Seq Scan = BAD (reads every row)
  - Index Scan = GOOD (reads only matching)
  - Rows Removed by Filter = wasted work
  - Buffers: shared hit = pages from cache

### 2.2 Index Strategies & Covering Indexes
- **B-tree index**: O(log n) lookups vs O(n) sequential
- **Covering index (INCLUDE)**: Serves query entirely from index
- **Partial index**: Only indexes rows matching condition
- **Composite index**: Multiple columns, leftmost prefix rule
- **Trade-off**: Every index slows writes (10 indexes = 10x write overhead)

### 2.3 N+1 Detection & Connection Pooling
- **N+1 problem**: 1 query + N lazy loads = N+1 total queries
- **Fixes**:
  - Eager loading: `.Include(u => u.Roles)`
  - Split query: `.AsSplitQuery()`
  - Explicit projection: `.Select(u => new DTO {...})`
- **Connection pooling**: PgBouncer reuses connections

---

## 3. Frontend
### 3.1 Core Web Vitals — LCP, INP, CLS
| Metric | What | Good | Poor |
|--------|------|------|------|
| LCP | Largest content paint | < 2.5s | > 4.0s |
| INP | Interaction to Next Paint | < 200ms | > 500ms |
| CLS | Cumulative Layout Shift | < 0.1 | > 0.25 |

### 3.2 Bundle Analysis & Tree Shaking
- **Bundle analysis**: Visualizes module contribution to size
- **Tree shaking**: Removes dead code (ES modules only)
- **Common culprits**: moment.js (300KB), lodash (70KB), full RxJS
- **Fixes**: Use lodash-es, date-fns, import operators individually
- **Budgets**: Set in angular.json (500KB warning, 1MB error)

### 3.3 Lazy Loading & Image Optimization
- **Lazy loading**: Defers route/module loading until needed
- **Image optimization**: WebP/AVIF, srcset, loading="lazy"
- **Angular**: NgOptimizedImage directive, priority attribute

---

## 4. Methodology
### 4.1 Profiling Workflow
**Measure → Hypothesize → Fix → Verify**

**Tools by layer**:
- .NET: dotnet-counters, dotnet-trace, dotnet-dump, Application Insights, MiniProfiler
- PostgreSQL: EXPLAIN ANALYZE, pg_stat_statements, pg_stat_user_tables
- Frontend: Chrome DevTools, Lighthouse, Angular DevTools, webpack-bundle-analyzer

### 4.2 Load Testing & Performance Budgets
- **Load testing**: k6 simulates concurrent users
- **Performance budgets**: Thresholds that fail CI when exceeded
- **Metrics**: http_req_duration, http_req_failed rate

---

## 5. Real-World Examples

### BenchmarkDotNet (String vs Span):
```csharp
// StringSplit: ~128B allocated
var parts = Header.Split('-', 2);
return Guid.Parse(parts[1]);

// SpanSlice: 0B allocated
var span = Header.AsSpan();
var idx = span.IndexOf('-') + 1;
return Guid.Parse(span[idx..]);
// Result: ~3x faster, 0B allocated
```

### EXPLAIN ANALYZE Fix:
```sql
-- Before: Seq Scan (450ms)
-- After: Index Only Scan (0.25ms) with covering index
CREATE INDEX ix_users_tenant_status_cover
ON users (tenant_id, status, created_at DESC)
INCLUDE (id, email);
```

### Angular Lazy Loading:
```typescript
{ path: 'admin', loadChildren: () => import('./features/admin/admin.routes') }
// Initial: ~150KB, Admin: ~80KB (loaded on demand)
```

---

## 6. Interview Q&A Summary
- **L1**: N+1 query problem and fixes
- **L2**: Using EXPLAIN ANALYZE to diagnose slow queries
- **L3**: .NET GC tuning for web servers
- **Staff**: Performance strategy across full-stack (DB → caching → frontend → .NET)
