---
title: OpenSearch & Full-Text Search
difficulty: L1 | L2 | L3 | Staff
lastUpdated: 2026-04-04
relatedTopics:
  - System-Design
  - Data-Structures-Algorithms
  - Logging-Observability
  - Security-CSP-DPoP
  - EFCore-SQL
---

## TL;DR

OpenSearch (an open-source fork of Elasticsearch) is a distributed, RESTful search and analytics engine built on Apache Lucene. While SQL databases use B-Trees optimized for exact lookups and ACID transactions, OpenSearch uses **Inverted Indices** optimized for **Full-Text Search**, **Log Analytics**, and **Vector (AI) Search** at massive scale. It achieves horizontal scalability by sharding indices across a cluster of nodes and uses the **BM25** scoring algorithm to rank results by relevance. In the `tai-portal` ecosystem, the **DocViewer** project runs OpenSearch in Docker (port 9200) to power document search across millions of legal/financial files — with multi-tenancy enforced via mandatory `TenantId` filters on every query. The same OpenSearch cluster can dual-serve as a log aggregation sink (separate `portal-logs-*` indices) for centralized observability.

## Deep Dive

### Concept Overview

#### 1. The Inverted Index (The Core Engine)
- **What:** An inverted index maps every unique token (word) to the list of Document IDs containing that token. It is the inverse of a forward index (which maps documents to their words).
- **Traditional DB (PostgreSQL):** Uses a B-Tree index. To find a word inside a text column, it often has to scan the actual rows (`LIKE '%contract%'`), which is $O(N)$ and extremely slow. PostgreSQL's `tsvector`/`GIN` index provides basic full-text search but lacks the analyzer pipeline, scoring sophistication, and horizontal scalability of a dedicated search engine.
- **OpenSearch (Lucene Engine):** When a document is ingested, an **Analyzer** pipeline processes the text:
  1. **Character Filters** — strip HTML tags, replace special characters
  2. **Tokenizer** — split text into individual tokens (e.g., whitespace, standard, pattern-based)
  3. **Token Filters** — lowercase, remove stop words ("the", "and"), stem words ("running" → "run"), apply synonyms ("car" → "automobile")

  The resulting tokens are stored in the inverted index, mapping each token to its Document IDs with position information.
- **Why it's fast:** Looking up "contract" in the inverted index is $O(1)$ hash lookup or $O(\log N)$ binary search on sorted terms — regardless of how many documents exist. Intersection of posting lists for multi-term queries uses efficient merge algorithms.
- *Analogy:* It is exactly like the index at the back of a textbook. You look up the word "contract" and it instantly gives you page numbers 14, 42, and 105.

#### 2. Architecture (Cluster, Nodes, Indices, Shards)
- **Cluster & Nodes:** An OpenSearch deployment is a "Cluster" made up of one or more "Nodes" (servers). Node roles include:
  - **Cluster Manager** (formerly Master) — manages cluster state, index creation, shard allocation
  - **Data Nodes** — store shards, execute queries and indexing
  - **Coordinating Nodes** — route requests, merge shard results (any node can coordinate)
  - **Ingest Nodes** — run ingest pipelines (transform documents before indexing)
- **Index:** The equivalent of a "Table" in SQL. (e.g., `documents` index in DocViewer). An index has a **mapping** (schema) that defines field types.
- **Shards:** Each index is split into one or more "Primary Shards." Each shard is a self-contained Lucene index. Sharding is how OpenSearch achieves massive horizontal scale — queries run in parallel across all shards.
- **Replicas:** Copies of Primary Shards on different nodes. They provide:
  - **High Availability** — if a node dies, replicas are promoted to primary
  - **Read Throughput** — search requests can be served by any replica
- **Sizing rule of thumb:** Each shard should hold 10-50GB of data. Too few shards = can't parallelize. Too many shards = coordination overhead and memory waste (each shard consumes ~50MB of JVM heap for metadata).

#### 3. The Analyzer Pipeline — Why "Indemnity" Finds "Indemnification"
- **What:** Analyzers control how text is broken into searchable tokens. They run at both **index time** (when documents are ingested) and **search time** (when queries are processed).
- **Built-in Analyzers:**
  | Analyzer | Behavior | Use Case |
  |----------|----------|----------|
  | `standard` | Unicode tokenization, lowercase, remove punctuation | General text (default) |
  | `simple` | Split on non-letter chars, lowercase | Simple text fields |
  | `whitespace` | Split on whitespace only, no lowercasing | Case-sensitive exact phrases |
  | `keyword` | No tokenization — entire value as one token | Exact match fields (IDs, enums) |
  | `english` | Standard + English stemming + stop words | English-language content |

- **Custom Analyzers:** For DocViewer's legal documents, a custom analyzer might combine:
  ```json
  {
    "analysis": {
      "analyzer": {
        "legal_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "english_stemmer", "legal_synonyms"]
        }
      },
      "filter": {
        "legal_synonyms": {
          "type": "synonym",
          "synonyms": ["indemnify,indemnification,indemnity", "breach,violation"]
        }
      }
    }
  }
  ```
- **The `.keyword` sub-field:** By default, OpenSearch creates two versions of `text` fields:
  - `client_name` → analyzed (tokenized, for full-text search)
  - `client_name.keyword` → not analyzed (exact value, for aggregations/sorting/filtering)

  This is why DocViewer uses `"client_name.keyword"` for the client filter and Terms aggregation — you want exact "Acme Corp", not tokenized "acme" + "corp".

#### 4. The Bool Query DSL — The Workhorse of OpenSearch
- **What:** The `bool` query is how you compose complex search logic. It has four clauses:
  | Clause | Behavior | Affects Score? | Example |
  |--------|----------|---------------|---------|
  | `must` | Document MUST match. AND logic. | Yes | Full-text search terms |
  | `filter` | Document MUST match. AND logic. | **No** (cached, fast) | TenantId, date ranges, channel |
  | `should` | Document SHOULD match. OR logic. | Yes (boosts score) | Optional relevance boosters |
  | `must_not` | Document MUST NOT match. NOT logic. | No | Exclude deleted documents |

- **Why `filter` vs `must` matters:** Filters skip scoring and are cached in a bitset. For multi-tenant systems, the `TenantId` filter is evaluated once and cached — subsequent queries for the same tenant reuse the bitset without re-evaluating. This is why tenant filtering belongs in `filter`, not `must`.
- **DocViewer's query structure follows this pattern exactly:** text search in `must`, tenant/channel/date in `filter`.

#### 5. The BM25 Scoring Algorithm — How Relevance Ranking Works
- **What:** BM25 (Best Matching 25) is the default scoring algorithm. It determines which documents are *most relevant* to a query.
- **The formula considers:**
  - **Term Frequency (TF):** How often does the search term appear in this document? More occurrences = higher relevance. But with diminishing returns — the 100th occurrence matters less than the 2nd.
  - **Inverse Document Frequency (IDF):** How rare is this term across ALL documents? Rare terms ("indemnification") score higher than common terms ("the").
  - **Field Length Normalization:** A match in a short field (subject: "Indemnity Clause") scores higher than the same match in a long field (content: 10,000 words including "indemnity").
- **Practical impact:** When a user searches "indemnity clause" in DocViewer, a 2-page document titled "Indemnity Clause Agreement" will rank higher than a 500-page contract that mentions "indemnity" once on page 347 — even though both contain the term.
- **Tuning:** You can boost specific fields:
  ```json
  {
    "multi_match": {
      "query": "indemnity clause",
      "fields": ["Subject^3", "FileName^2", "Content"],
      "type": "best_fields"
    }
  }
  ```
  `Subject^3` means a match in the subject field is weighted 3x more than a match in content.

#### 6. The Query Process (Scatter/Gather)
When a user searches the DocViewer API:
1. The API sends a JSON request to *any* node in the OpenSearch cluster (the **Coordinator Node**).
2. **Scatter (Query Phase):** The Coordinator forwards the search to every shard (primary or replica) belonging to that index. Each shard executes the query locally using its inverted index and returns only the top-N document IDs + scores (not full documents).
3. **Gather (Fetch Phase):** The Coordinator merges and globally sorts results by BM25 score. It then fetches the full document content only for the final top results from the relevant shards.
4. Results are returned to the API.

**Why two phases?** If every shard returned full documents, network bandwidth would explode. The query phase transfers only IDs and scores (~100 bytes per result). Only the final page of results triggers full document fetches.

#### 7. Mappings — The Schema of OpenSearch
- **What:** A mapping defines the fields in an index and their data types. Unlike SQL, mappings can be dynamic (auto-inferred) or explicit.
- **Core field types:**
  | Type | Indexed As | Use Case |
  |------|-----------|----------|
  | `text` | Inverted index (analyzed) | Full-text searchable content |
  | `keyword` | Inverted index (exact value) | Filtering, sorting, aggregations |
  | `date` | BKD tree | Date range queries |
  | `integer`/`long`/`float` | BKD tree | Numeric range queries |
  | `boolean` | Inverted index | Simple filters |
  | `nested` | Separate hidden document | Arrays of objects with independent field queries |
  | `knn_vector` | HNSW/IVF graph | Vector similarity search (AI embeddings) |

- **Dynamic Mapping Dangers:** By default, OpenSearch auto-detects field types from the first document. This causes problems:
  - First doc has `"year": "2026"` → mapped as `text`. Second doc has `"year": 2026` → indexing fails (number into text field).
  - **Solution:** Always define explicit mappings for production indices.

#### 8. Index Lifecycle Management (ILM) — Managing Data Growth
- **What:** ILM automates the lifecycle of indices through phases: **Hot → Warm → Cold → Delete**.
- **Why:** Log indices (`portal-logs-*`) grow unboundedly. Without ILM, disk fills up and the cluster crashes.
- **Typical policy for log indices:**
  | Phase | Trigger | Action |
  |-------|---------|--------|
  | Hot | Current index | Write-optimized, SSDs, all replicas |
  | Warm | Index age > 7 days | Read-only, force merge to 1 segment, cheaper storage |
  | Cold | Index age > 30 days | Frozen (minimal resources, slow queries ok) |
  | Delete | Index age > 90 days | Remove from cluster |

- **For document indices (DocViewer):** ILM is different — documents are not temporal. Instead, use index rollover based on shard size (roll when a shard exceeds 40GB) and never auto-delete.
- **Configuration:**
  ```json
  PUT _plugins/_ism/policies/log-retention
  {
    "policy": {
      "description": "Log retention: hot 7d, warm 30d, delete 90d",
      "default_state": "hot",
      "states": [
        {
          "name": "hot",
          "actions": [{ "rollover": { "min_index_age": "7d" } }],
          "transitions": [{ "state_name": "warm", "conditions": { "min_index_age": "7d" } }]
        },
        {
          "name": "warm",
          "actions": [{ "read_only": {} }, { "force_merge": { "max_num_segments": 1 } }],
          "transitions": [{ "state_name": "delete", "conditions": { "min_index_age": "90d" } }]
        },
        { "name": "delete", "actions": [{ "delete": {} }] }
      ]
    }
  }
  ```

#### 9. Vector Search (k-NN) — AI-Powered Semantic Search
- **What:** Beyond keyword matching, OpenSearch supports **vector similarity search** using the k-Nearest Neighbors (k-NN) plugin. Documents are represented as high-dimensional vectors (embeddings) generated by ML models, and queries find the most semantically similar vectors.
- **Why:** Keyword search fails when users express concepts differently than how documents are written. "money owed to vendor" won't match a document about "accounts payable" — but their vector embeddings will be close in semantic space.
- **How it works:**
  1. At ingestion: an embedding model (e.g., OpenAI's `text-embedding-3-small`, Cohere, or a local model) converts document text into a 1536-dimensional vector.
  2. The vector is stored in a `knn_vector` field using HNSW (Hierarchical Navigable Small World) graph indexing.
  3. At query time: the search query is embedded using the same model, and OpenSearch finds the k nearest vectors.
- **Hybrid Search:** The most powerful approach combines keyword (BM25) and vector (k-NN) scores:
  ```json
  {
    "query": {
      "hybrid": {
        "queries": [
          { "match": { "Content": "indemnity clause" } },
          { "knn": { "content_vector": { "vector": [0.12, -0.34, ...], "k": 10 } } }
        ]
      }
    }
  }
  ```
- **For DocViewer's roadmap:** As the document corpus grows, hybrid search would allow users to search by meaning ("find documents about payment disputes") rather than exact terminology.
- **Trade-offs:** Vector indexing requires significantly more RAM (HNSW graphs are memory-resident). A 1M document index with 1536-dim vectors needs ~6GB of additional heap. The embedding step adds latency at ingest time and requires an ML model serving infrastructure.

#### 10. The .NET OpenSearch Client — Patterns and Anti-Patterns
- **What:** The `OpenSearch.Client` NuGet package (successor to NEST for Elasticsearch) provides a strongly-typed .NET client with a fluent query builder.
- **Connection setup:**
  ```csharp
  var settings = new ConnectionSettings(new Uri("http://localhost:9200"))
      .DefaultIndex("documents")
      .EnableDebugMode();  // Remove in production — serializes request/response for logging
  var client = new OpenSearchClient(settings);
  ```
- **Key patterns:**
  - **Use `SearchDescriptor<T>` for type-safe queries** — compile-time field name validation via lambda expressions
  - **Use `BulkAsync` for batch ingestion** — individual `IndexAsync` calls are $O(N)$ HTTP round trips; bulk is $O(1)$
  - **Use `filter` context for non-scoring clauses** — tenant filters, date ranges, status flags
  - **Check `response.IsValid` on every call** — OpenSearch returns 200 even for partial failures in bulk operations
- **Anti-patterns:**
  - **String field names** — `"client_name.keyword"` is fragile. Use `f => f.Field("client_name.keyword")` or define a property attribute.
  - **Unbounded `Size`** — `Size(10000)` loads all results into memory. Use scroll/search_after for large result sets.
  - **Missing error handling on bulk** — `BulkAsync` can succeed overall but fail on individual documents. Always check `bulkResponse.ItemsWithErrors`.

### Why OpenSearch vs. PostgreSQL? (Trade-Offs)

| Feature | PostgreSQL (SQL) | OpenSearch (NoSQL/Search) |
| :--- | :--- | :--- |
| **Primary Use Case** | Relational Data, Financial Ledgers | Full-Text Search, Logs, AI Vectors |
| **Indexing** | B-Tree (Great for exact matches/IDs) | Inverted Index (Great for unstructured text) |
| **Consistency** | **Strong (ACID)** — Instantly consistent | **Eventual (Near Real-Time)** — ~1s delay |
| **Scaling** | Vertical (Bigger server) | **Horizontal** (More servers / Shards) |
| **Ranking/Scoring** | Poor/Basic (`ts_rank` is rudimentary) | **Advanced (BM25)** — Ranks by relevance with field boosting |
| **Joins** | Native (foreign keys, subqueries) | None — denormalize at index time |
| **Aggregations** | `GROUP BY` (strong) | Terms, histograms, nested aggs (excellent for analytics) |
| **Transactions** | ACID with row-level locking | No transactions — eventual consistency per shard |

**Trade-off Summary:** OpenSearch sacrifices strict ACID consistency (it takes ~1 second for an ingested document to become searchable) and requires managing a complex distributed cluster. In return, it provides sub-second, relevancy-scored search across billions of text documents — something PostgreSQL simply cannot do. The correct architecture uses both: PostgreSQL as the source of truth, OpenSearch as a read-optimized search projection.

---

### Real-World Application: The DocViewer Project

In the `tai-portal` ecosystem, the **DocViewer** project handles millions of multi-page legal and financial documents.

#### Docker Setup (Local Development)
DocViewer runs OpenSearch as a single-node Docker container:
```yaml
# docker-compose.yml
services:
  opensearch:
    image: opensearchproject/opensearch:latest
    environment:
      - discovery.type=single-node
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
      - plugins.security.disabled=true   # Dev only — enable in production
    ports:
      - "9200:9200"   # REST API
      - "9600:9600"   # Performance analyzer
```
Key settings: `discovery.type=single-node` disables cluster formation (no need for quorum in dev). `-Xms512m -Xmx512m` caps JVM heap — OpenSearch is memory-hungry; in production, allocate 50% of RAM to heap (max 32GB due to JVM compressed oops threshold).

#### The Document Model
```csharp
// DocViewer.Domain/Entities/Document.cs
public class Document
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;      // "Fax", "Email", "Scan", "Ftp"
    public string Client { get; set; } = string.Empty;
    [JsonPropertyName("client_name")]
    public string? clientName { get; set; }                   // Maps to client_name.keyword for exact filtering
    public DateTime Date { get; set; }
    public string Sender { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;       // Full-text searchable via inverted index
    public Dictionary<string, object> Metadata { get; set; }  // Flexible key-value metadata
}
```

#### The Search Service — Bool Query with Filter Context
The core search logic demonstrates every concept from the Deep Dive:
```csharp
// DocViewer.Infrastructure/Services/OpenSearchService.cs
public async Task<List<Document>> SearchDocumentsAsync(
    string? query, string? channel, string? client,
    DateTime? fromDate, DateTime? toDate, int page = 1, int pageSize = 20)
{
    var searchDescriptor = new SearchDescriptor<Document>()
        .From((page - 1) * pageSize)   // Pagination offset
        .Size(pageSize)
        .Sort(s => s
            .Field(f => f.Date, SortOrder.Descending)
            .Field(f => f.Id, SortOrder.Ascending));  // Tiebreaker for stable pagination

    List<Func<QueryContainerDescriptor<Document>, QueryContainer>> mustQueries = new();
    List<Func<QueryContainerDescriptor<Document>, QueryContainer>> filterQueries = new();

    // Full-text search → must clause (affects relevance score)
    if (!string.IsNullOrWhiteSpace(query))
    {
        mustQueries.Add(q => q.Bool(b => b.Should(
            // Wildcard on filename for partial matches ("001" in "fax_statement_001.txt")
            sh => sh.Wildcard(w => w.Field(f => f.FileName).Value($"*{query.ToLowerInvariant()}*")),
            // Multi-match on text fields — BM25 scoring across Subject, Content, Sender
            sh => sh.MultiMatch(mm => mm
                .Query(query)
                .Fields(f => f.Field(d => d.FileName).Field(d => d.Subject)
                              .Field(d => d.Content).Field(d => d.Sender))
                .Type(TextQueryType.BestFields))
        ).MinimumShouldMatch(1)));
    }

    // Structured filters → filter clause (no scoring, cached)
    if (!string.IsNullOrWhiteSpace(channel))
        filterQueries.Add(q => q.Term(t => t.Field(f => f.Channel).Value(channel.ToLowerInvariant())));

    if (!string.IsNullOrWhiteSpace(client))
        filterQueries.Add(q => q.Term(t => t.Field("client_name.keyword").Value(client)));

    if (fromDate.HasValue || toDate.HasValue)
        filterQueries.Add(q => q.DateRange(dr => dr.Field(f => f.Date)
            .GreaterThanOrEquals(fromDate?.ToString("yyyy-MM-dd"))
            .LessThanOrEquals(toDate?.ToString("yyyy-MM-dd"))));

    // Compose the bool query
    if (mustQueries.Count > 0 || filterQueries.Count > 0)
        searchDescriptor.Query(q => q.Bool(b => {
            if (mustQueries.Count > 0) b.Must(mustQueries.ToArray());
            if (filterQueries.Count > 0) b.Filter(filterQueries.ToArray());
            return b;
        }));
    else
        searchDescriptor.Query(q => q.MatchAll(ma => ma));

    var response = await _client.SearchAsync<Document>(searchDescriptor);
    if (!response.IsValid)
    {
        _logger.LogError("OpenSearch query failed: {Error}", response.DebugInformation);
        return new List<Document>();
    }
    return response.Documents.ToList();
}
```

**What to notice:**
1. **`must` vs `filter` separation** — text search in `must` (needs scoring), channel/client/date in `filter` (no scoring, cached)
2. **Wildcard + MultiMatch fallback** — wildcards enable partial filename matches; multi-match provides BM25 relevance across text fields
3. **`.keyword` for exact filtering** — `"client_name.keyword"` ensures "Acme Corp" matches exactly, not "acme" OR "corp"
4. **Pagination via `From`/`Size`** — simple offset pagination. For deep pagination (page 1000+), use `search_after` to avoid the $O(from + size)$ memory cost per shard.

#### Bulk Ingestion
```csharp
// Efficient batch indexing — single HTTP request for N documents
public async Task IndexDocumentsAsync(IEnumerable<Document> documents)
{
    var docList = documents.ToList();
    if (docList.Count == 0) return;

    var bulkResponse = await _client.BulkAsync(b => b
        .Index(IndexName)
        .IndexMany(docList));

    if (!bulkResponse.IsValid)
        throw new Exception($"Bulk indexing failed: {bulkResponse.DebugInformation}");

    _logger.LogInformation("Indexed {Count} documents", docList.Count);
}
```

#### Aggregations — Analytics Without a Second Query
```csharp
// Get distinct client names via Terms aggregation — no SQL GROUP BY needed
public async Task<List<string>> GetClientNamesAsync()
{
    var response = await _client.SearchAsync<Document>(s => s
        .Index(IndexName)
        .Size(0)                                  // No documents, only aggregation results
        .Aggregations(a => a.Terms("clients", t => t
            .Field("client_name.keyword")         // Must use .keyword for exact terms
            .Size(100))));

    return response.Aggregations.Terms("clients").Buckets
        .Select(b => b.Key.ToString())
        .Where(c => !string.IsNullOrEmpty(c))
        .OrderBy(c => c).ToList();
}
```
**Key insight:** `Size(0)` tells OpenSearch to skip the query phase entirely and only compute the aggregation — significantly faster when you only need the facet values.

#### Multi-Tenancy Security
Just like EF Core Global Query Filters, we must enforce zero-trust in OpenSearch. The backend API intercepts every user search request and forcibly appends a strict boolean filter:
```json
{
  "query": {
    "bool": {
      "must": [ { "match": { "Content": "indemnity clause" } } ],
      "filter": [ { "term": { "TenantId": "123-abc" } } ]
    }
  }
}
```
This filter is injected server-side — the Angular frontend never controls tenant scoping. Even if a client modifies the search request, the backend overwrites the `TenantId` filter with the authenticated user's tenant from the JWT claims.

### Key Takeaways
- **Inverted indices trade write speed for read speed** — ingestion involves analysis + indexing, but searches are near-instant
- **`filter` context is your best friend** — no scoring overhead, bitset-cached, use for every non-relevance clause
- **Always define explicit mappings** — dynamic mapping causes type conflicts and mapping explosions in multi-tenant systems
- **PostgreSQL is the source of truth, OpenSearch is the search projection** — never write business logic that depends on OpenSearch's eventual consistency
- **BM25 scoring is automatic** — you don't need to understand the math, but knowing TF-IDF + field length normalization explains why results rank the way they do
- **The `.keyword` sub-field is critical** — use analyzed `text` fields for full-text search, `.keyword` fields for filtering/sorting/aggregation

---

## Interview Q&A

### L1: What Is an Inverted Index and Why Is It Faster Than a Database for Text Search?
**Difficulty:** L1 (Junior)

**Question:** Explain what an inverted index is and why OpenSearch is faster than PostgreSQL for full-text search.

**Answer:** An inverted index maps every unique word to the list of documents containing that word — like the index at the back of a textbook. When you search for "contract", OpenSearch looks up that word in the index and immediately gets document IDs 14, 42, and 105 in O(1) time. PostgreSQL would have to scan every row and check if the text column contains "contract" using `LIKE '%contract%'`, which is O(N) and gets slower as the table grows. OpenSearch also applies analyzers that stem words ("running" → "run") and handle synonyms, so searches are both faster and more linguistically intelligent.

---

### L1: What Is the Difference Between `text` and `keyword` Field Types?
**Difficulty:** L1 (Junior)

**Question:** In OpenSearch, when would you use a `text` field versus a `keyword` field?

**Answer:** A `text` field is analyzed — the value is tokenized, lowercased, and stemmed before indexing. It's used for full-text search where you want "quick brown fox" to match a search for "brown fox." A `keyword` field is stored as-is, no analysis. It's used for exact matching, sorting, and aggregations — like filtering by `status: "active"` or getting distinct client names. By default, OpenSearch creates both for string fields: `client_name` (text, for search) and `client_name.keyword` (keyword, for filtering and aggregations).

---

### L2: Relational DB vs Search Engine
**Difficulty:** L2 (Mid-Level)

**Question:** Why do we maintain both PostgreSQL and OpenSearch in our architecture? Why not just put everything in OpenSearch since it's so fast?

**Answer:** PostgreSQL and OpenSearch solve fundamentally different problems. PostgreSQL is an ACID-compliant relational database — when money is transferred or a user is approved, the data is instantly consistent and safely committed to disk. It supports joins, foreign keys, and transactions. OpenSearch is an Eventually Consistent search engine — it trades strict transactional safety for horizontal scalability, full-text search speed, and relevance ranking. It has no joins or transactions.

We use PostgreSQL as the single source of truth for business data and sync searchable projections to OpenSearch. If OpenSearch goes down, no data is lost — we rebuild from PostgreSQL. If we put business data only in OpenSearch, we'd risk data loss during cluster failures and couldn't enforce referential integrity between entities.

---

### L2: Explain the Bool Query DSL and Why Filter Context Matters
**Difficulty:** L2 (Mid-Level)

**Question:** In the DocViewer search service, we separate queries into `must` and `filter` clauses. What's the difference and why does it matter for performance?

**Answer:** The `must` clause requires documents to match AND contributes to the relevance score — OpenSearch runs BM25 scoring on these clauses to rank results. The `filter` clause requires documents to match but does NOT affect scoring. This matters for two reasons:

1. **Performance:** Filters skip the expensive scoring calculation. More importantly, filter results are cached in a bitset. For multi-tenant systems, the TenantId filter is evaluated once and cached — every subsequent query for the same tenant reuses the cached bitset, making it essentially free.

2. **Correctness:** If you put a TenantId term match in `must` instead of `filter`, it would artificially boost the relevance score of every document (since every document matches the tenant filter). This doesn't change which documents are returned, but it distorts the relative ranking between documents.

In DocViewer, text search goes in `must` (we want relevance ranking), and channel, client, and date range go in `filter` (we want exact filtering without score distortion).

---

### L3: Handling the NRT (Near Real-Time) Delay
**Difficulty:** L3 (Senior)

**Question:** OpenSearch has a "Refresh Interval" (usually 1 second), meaning a document isn't searchable the exact millisecond it is ingested. How do you design the UI/UX in the DocViewer project to handle this eventual consistency without confusing the user?

**Answer:** When a user uploads a document, the API saves the file to Blob Storage, dispatches an event to the background indexer, and immediately returns a `202 Accepted` (not 200 OK) with the new Document ID. The Angular frontend doesn't immediately query OpenSearch to refresh the list; instead, it optimistically adds the document to the top of the UI list in a "Processing..." state. We rely on a SignalR push notification from the background worker to tell the frontend when the OpenSearch index has finally refreshed, at which point the UI changes the status to "Ready."

For batch operations (bulk import of 10,000 documents), we use a progress bar driven by SignalR events. The API returns immediately with a job ID, the background worker indexes in batches (using `BulkAsync` with 500 documents per request), and publishes progress events. The frontend shows "Indexing: 4,500 / 10,000" without ever polling OpenSearch directly.

The key principle: **never let the UI depend on OpenSearch's refresh interval for user-facing state transitions.** Use event-driven notifications to bridge the consistency gap.

---

### L3: Dealing with Mapping Explosions
**Difficulty:** L3 (Senior)

**Question:** In OpenSearch, what is a "Mapping Explosion," and how can it bring down a cluster in a multi-tenant system where users can define their own custom fields?

**Answer:** OpenSearch stores the mapping (field definitions) for every index in the cluster state, which is held in memory on every node. When dynamic mapping is enabled, each unique JSON key in ingested documents creates a new field in the mapping. If 1,000 tenants each create 50 custom fields (`"Tenant_A_CustomField_1"`, ...), the mapping grows to 50,000 fields. Each field consumes heap memory for its analyzer, field data, and doc values. At scale, this causes the cluster to run out of heap and crash — or simply become unresponsive during cluster state updates.

Three mitigation strategies:

1. **Disable dynamic mapping** (`"dynamic": "strict"`) — reject documents with unknown fields. Forces schema discipline.
2. **Key-Value array pattern** — instead of `{"CustomField": "value"}`, store `[{"key": "CustomField", "value": "value"}]`. The mapping only ever has `key` and `value` fields regardless of tenant-defined field names.
3. **`total_fields.limit`** — set `index.mapping.total_fields.limit` to a sane number (default 1000). This prevents accidental explosions but is a safety net, not a solution.

The Key-Value pattern is the production answer for DocViewer's `Metadata` dictionary. It allows unlimited tenant-specific metadata without growing the mapping.

---

### L3: Deep Pagination — Why `From + Size` Breaks at Scale
**Difficulty:** L3 (Senior)

**Question:** A user wants to export all 500,000 documents from the DocViewer search results. The current implementation uses `From`/`Size` pagination. What happens if they try to access page 25,000 (offset 500,000)?

**Answer:** OpenSearch's `From`/`Size` pagination has a fundamental problem: to return results at offset N, every shard must return its top N + Size results to the coordinator node, which then globally sorts and discards all but the final Size results. At page 25,000 (offset 500,000), each of 5 shards would need to sort and return 500,020 results — consuming massive memory and CPU. OpenSearch enforces a hard limit of `index.max_result_window` (default 10,000) and rejects deeper requests.

Three alternatives:

1. **`search_after`** — use the sort values of the last result as a cursor for the next page. Each page only needs to process Size results per shard, not From + Size. This is what DocViewer should use for "load more" pagination:
   ```json
   { "search_after": ["2026-03-15T00:00:00Z", "doc-12345"], "size": 20, "sort": [{"Date": "desc"}, {"Id": "asc"}] }
   ```
2. **Scroll API** — creates a snapshot of the search results and allows iterating through all of them. Used for bulk exports. Holds resources on the server, so set a short timeout (`scroll: "5m"`).
3. **Point in Time (PIT)** — the modern replacement for Scroll. Creates a lightweight snapshot without holding search context resources. Combine with `search_after` for efficient full-dataset iteration.

For the export use case, use PIT + `search_after` in a background job that streams results to a CSV file, then notify the user via SignalR when the export is ready.

---

### Staff: Designing Multi-Tenant OpenSearch for a SaaS Platform
**Difficulty:** Staff

**Question:** You're designing the OpenSearch architecture for a SaaS platform like tai-portal with 500 tenants ranging from 100 to 10 million documents each. How do you handle multi-tenancy — index-per-tenant, shared index with tenant field, or something else?

**Answer:** There are three strategies, each with clear trade-offs:

**1. Shared Index with Tenant Field (DocViewer's current approach)**
- All tenants share one index. Every query includes `"filter": [{"term": {"TenantId": "abc"}}]`.
- **Pros:** Simple to manage, single mapping, efficient shard utilization.
- **Cons:** Noisy neighbor problem — one tenant's 10M document reindex degrades search latency for all tenants. No per-tenant retention policies or capacity limits. Mapping explosions if tenants can define custom fields.
- **Good for:** <100 tenants of similar size. This is DocViewer's POC stage.

**2. Index-Per-Tenant**
- Each tenant gets their own index: `documents-tenant-abc`, `documents-tenant-xyz`.
- **Pros:** Complete isolation — reindexing, mapping changes, and retention are per-tenant. One tenant's problems don't affect others.
- **Cons:** At 500 tenants × 5 primary shards × 1 replica = 5,000 shards. Each shard consumes ~50MB of heap, so 5,000 shards = 250GB of JVM heap just for shard metadata. OpenSearch clusters typically start degrading at 1,000-2,000 shards per node.
- **Good for:** <50 tenants with very different data shapes or compliance requirements (e.g., financial institutions that require physical data isolation).

**3. Tenant-Aware Index Routing (Hybrid)**
- Shared indices, but use **custom routing** to co-locate all of a tenant's documents on the same shard: `_routing: TenantId`.
- **Pros:** Queries for a single tenant hit exactly one shard (no scatter to all shards). The filter cache is per-shard, so each shard's cache is tenant-specific. Dramatically reduces query fan-out.
- **Cons:** Uneven shard sizes if tenants vary in size. The 10M-document tenant's shard becomes a hot spot while the 100-document tenant's shard sits idle.
- **Good for:** 50-1000 tenants with moderate size variance. Add shard-level monitoring to detect and rebalance hot spots.

**My recommendation for tai-portal at scale:**

Start with Strategy 1 (current — simple, proven). When tenant count exceeds 100 or noisy-neighbor complaints emerge, migrate to Strategy 3 (routing-based) — it requires only adding `?routing=TenantId` to index and search requests, no data migration. Reserve Strategy 2 for the rare tenant that demands contractual data isolation (regulated bank, government).

Regardless of strategy, enforce these guardrails:
- **Server-side tenant filter injection** — never trust the client to supply TenantId
- **Rate limiting per tenant** — prevent one tenant from monopolizing cluster resources with expensive aggregations
- **Index templates** — define mappings, settings, and aliases via templates so new indices are consistent
- **Monitoring** — track per-tenant query latency, shard sizes, and cache hit rates in OpenSearch Dashboards

---

## Cross-References

- **[[System-Design]]** — YARP gateway architecture, MediatR CQRS (OpenSearch as a read-model projection), multi-tenancy patterns
- **[[Data-Structures-Algorithms]]** — Inverted index as a data structure, hash maps for term lookups, merge algorithms for posting list intersection
- **[[Logging-Observability]]** — OpenSearch as a dual-purpose log aggregation sink, ILM for log retention, Serilog → OpenSearch sink configuration
- **[[Security-CSP-DPoP]]** — Zero-trust tenant filtering in OpenSearch mirrors DPoP token binding; both enforce "never trust the client"
- **[[EFCore-SQL]]** — Global Query Filters for SQL-side multi-tenancy parallel OpenSearch's `filter` clause; PostgreSQL as source of truth syncing to OpenSearch
- **[[Message-Queues]]** — Event-driven document indexing pipeline (document uploaded → message → background worker → OpenSearch); Outbox pattern for guaranteed index consistency

---

## Further Reading

- [OpenSearch Documentation](https://opensearch.org/docs/latest/)
- [Inverted Index Explained](https://www.elastic.co/guide/en/elasticsearch/guide/current/inverted-index.html)
- [The BM25 Scoring Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
- [OpenSearch Query DSL](https://opensearch.org/docs/latest/query-dsl/)
- [OpenSearch k-NN Plugin](https://opensearch.org/docs/latest/search-plugins/knn/index/)
- [Index State Management (ISM)](https://opensearch.org/docs/latest/im-plugin/ism/index/)
- [OpenSearch .NET Client](https://opensearch.org/docs/latest/clients/OpenSearch-dot-net/)
- [Multi-Tenancy Patterns in Search Engines](https://www.elastic.co/blog/found-multi-tenancy)

---

*Last updated: 2026-04-04*