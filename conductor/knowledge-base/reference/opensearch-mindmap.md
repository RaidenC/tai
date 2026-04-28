# OpenSearch & Full-Text Search — Mindmap

## 1. The Inverted Index (Core Engine)
- **What**: Maps every unique token → list of Document IDs containing it
- **vs B-Tree (PostgreSQL)**: DB scans rows O(N), OpenSearch lookup O(1)
- **Like textbook index**: Look up "contract" → instantly get page numbers
- **Analyzer Pipeline**:
  1. Character Filters (strip HTML, special chars)
  2. Tokenizer (split into tokens)
  3. Token Filters (lowercase, stem, synonyms)

---

## 2. Architecture (Cluster, Nodes, Indices, Shards)

### Cluster Components:
- **Cluster Manager**: Manages cluster state, shard allocation
- **Data Nodes**: Store shards, execute queries/indexing
- **Coordinating Nodes**: Route requests, merge results
- **Ingest Nodes**: Run ingest pipelines

### Key Concepts:
- **Index**: Like "Table" in SQL (e.g., `documents`)
- **Shards**: Each index split into Primary Shards (self-contained Lucene index)
- **Replicas**: Copies of Primary Shards for HA + read throughput
- **Sizing**: Each shard 10-50GB; too many = memory overhead (~50MB heap each)

---

## 3. The Analyzer Pipeline

### Built-in Analyzers:
| Analyzer | Behavior | Use Case |
|----------|----------|----------|
| standard | Unicode tokenization, lowercase | General text (default) |
| simple | Split on non-letter, lowercase | Simple text |
| whitespace | Split on whitespace only | Case-sensitive exact |
| keyword | No tokenization — exact value | IDs, enums |
| english | Standard + stemming + stop words | English content |

### Custom Analyzers:
- Combine tokenizer + filters (e.g., stemmer, synonyms)
- Example: "indemnity" → "indemnify" → "indemnification"

### `.keyword` sub-field:
- `client_name` → analyzed (full-text search)
- `client_name.keyword` → exact value (filtering, sorting, aggregation)

---

## 4. The Bool Query DSL

### Four Clauses:
| Clause | Logic | Affects Score? | Example |
|--------|-------|----------------|---------|
| must | AND | Yes | Full-text search |
| filter | AND | **No** (cached) | TenantId, date ranges |
| should | OR | Yes (boosts) | Optional boosters |
| must_not | NOT | No | Exclude deleted |

### Why Filter Matters:
- Skips scoring, cached in bitset
- TenantId filter evaluated once → cached for all subsequent queries

---

## 5. BM25 Scoring Algorithm
- **Term Frequency (TF)**: How often term appears → more = higher relevance (diminishing returns)
- **Inverse Document Frequency (IDF)**: Rare terms score higher than common
- **Field Length Normalization**: Match in short field > match in long field
- **Field Boosting**: `Subject^3` weights subject field 3x more

---

## 6. Query Process (Scatter/Gather)
1. Request → any node (Coordinator)
2. **Scatter Phase**: Coordinator → all shards → each returns top-N IDs + scores
3. **Gather Phase**: Coordinator merges, sorts globally → fetches full docs for top results
4. Returns to API

**Why two phases**: Saves network bandwidth (only IDs/scores in phase 1)

---

## 7. Mappings (Schema)

### Core Field Types:
| Type | Indexed As | Use Case |
|------|-----------|----------|
| text | Inverted index | Full-text searchable |
| keyword | Exact value | Filtering, sorting, aggregations |
| date | BKD tree | Date range queries |
| integer/long/float | BKD tree | Numeric ranges |
| nested | Hidden document | Arrays of objects |
| knn_vector | HNSW graph | Vector similarity (AI) |

### Danger: Dynamic Mapping
- First doc `"year": "2026"` → text
- Second doc `"year": 2026 → indexing fails
- **Solution**: Always define explicit mappings for production

---

## 8. Index Lifecycle Management (ILM)
### Phases: Hot → Warm → Cold → Delete

| Phase | Trigger | Action |
|-------|---------|--------|
| Hot | Current index | Write-optimized, SSDs |
| Warm | >7 days | Read-only, force merge |
| Cold | >30 days | Frozen, minimal resources |
| Delete | >90 days | Remove |

### For Document Indices:
- Based on shard size (rollover at 40GB), not time-based
- Never auto-delete documents

---

## 9. Vector Search (k-NN)
- **What**: Semantic similarity using embeddings
- **How**:
  1. Ingest: ML model → document → 1536-dim vector
  2. Store: `knn_vector` field with HNSW indexing
  3. Query: Embed query → find k nearest vectors
- **Hybrid Search**: Combine BM25 + k-NN
- **Trade-offs**: Significant RAM (HNSW graphs memory-resident)

---

## 10. .NET OpenSearch Client

### Connection:
```csharp
var settings = new ConnectionSettings(new Uri("http://localhost:9200"))
    .DefaultIndex("documents");
var client = new OpenSearchClient(settings);
```

### Best Practices:
- Use `SearchDescriptor<T>` for type-safe queries
- Use `BulkAsync` for batch ingestion
- Use `filter` context for non-scoring clauses
- Check `response.IsValid` on every call

### Anti-patterns:
- String field names (fragile)
- Unbounded `Size` (memory explosion)
- Missing error handling on bulk

---

## 11. OpenSearch vs PostgreSQL

| Feature | PostgreSQL | OpenSearch |
|---------|------------|------------|
| Primary Use | Relational Data | Full-Text Search, Logs |
| Indexing | B-Tree | Inverted Index |
| Consistency | Strong (ACID) | Eventual (~1s delay) |
| Scaling | Vertical | Horizontal |
| Ranking | Basic | Advanced (BM25) |
| Joins | Native | None (denormalize) |
| Transactions | ACID | None |

**Architecture**: PostgreSQL = source of truth; OpenSearch = read-optimized search projection

---

## 12. Real-World: DocViewer Project

### Docker Setup:
- Single-node Docker: `discovery.type=single-node`
- JVM heap: 512m (dev), 50% RAM (prod, max 32GB)

### Document Model:
- Fields: FileName, Channel, Client, Date, Sender, Subject, Content, Metadata
- `client_name.keyword` for exact filtering

### Search Service:
- Text search → `must` clause (relevance)
- Channel/Client/Date → `filter` clause (cached)

### Multi-Tenancy Security:
- Server-side TenantId filter injection
- Never trust client-supplied tenant

---

## 13. Interview Q&A Summary
- **L1**: Inverted index vs B-Tree; text vs keyword fields
- **L2**: Why both PostgreSQL + OpenSearch; Bool query filter context
- **L3**: NRT delay UI handling; Mapping explosions; Deep pagination (search_after, PIT)
- **Staff**: Multi-tenant strategies (shared index, index-per-tenant, routing-based)
