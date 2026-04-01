---
title: OpenSearch & Full-Text Search
difficulty: L2 | L3 | Staff
lastUpdated: 2026-03-31
relatedTopics:
  - System-Design
  - Data-Structures-Algorithms
---

## TL;DR

OpenSearch (an open-source fork of Elasticsearch) is a distributed, RESTful search and analytics engine. While standard SQL databases (like PostgreSQL) are built for relational data and ACID transactions, OpenSearch is built specifically for **Full-Text Search**, **Log Analytics**, and **Vector (AI) Search** at a massive scale. It achieves this by using **Inverted Indices** instead of B-Trees, and by natively sharding data across a cluster of nodes.

## Deep Dive

### Concept Overview: How OpenSearch Works

#### 1. The Inverted Index (The Core Engine)
- **Traditional DB (PostgreSQL):** Uses a B-Tree index. To find a word inside a text column, it often has to scan the actual rows (`LIKE '%contract%'`), which is $O(N)$ and extremely slow.
- **OpenSearch (Lucene Engine):** Uses an **Inverted Index**. When a document is ingested, an "Analyzer" breaks the text down into individual tokens (words), removes stop words ("the", "and"), and stems them ("running" -> "run"). It then creates an index mapping every unique token to the exact Document IDs where it appears. 
- *Analogy:* It is exactly like the index at the back of a textbook. You look up the word "contract" and it instantly gives you page numbers 14, 42, and 105 in $O(1)$ or $O(\log N)$ time.

#### 2. Architecture (Cluster, Nodes, Indices, Shards)
- **Cluster & Nodes:** An OpenSearch deployment is a "Cluster" made up of one or more "Nodes" (servers).
- **Index:** The equivalent of a "Table" in SQL. (e.g., `docviewer-files` index).
- **Shards:** As an Index grows too large for one server's hard drive, OpenSearch splits the Index into multiple "Primary Shards". Sharding is how OpenSearch achieves massive horizontal scale.
- **Replicas:** Copies of the Primary Shards distributed to different nodes. They provide High Availability (if a node dies, no data is lost) and increase read performance (queries can be served by replicas).

#### 3. The Query Process (Scatter/Gather)
When a user searches the DocViewer API:
1. The API sends a JSON request to *any* node in the OpenSearch cluster (the Coordinator Node).
2. **Scatter:** The Coordinator forwards the search to every shard (primary or replica) belonging to that index.
3. **Gather:** Each shard executes the search locally using its inverted index and returns its top matches.
4. The Coordinator merges and sorts the results (using the BM25 scoring algorithm) and returns the final list to the API.

### Why OpenSearch vs. PostgreSQL? (Trade-Offs)

| Feature | PostgreSQL (SQL) | OpenSearch (NoSQL/Search) |
| :--- | :--- | :--- |
| **Primary Use Case** | Relational Data, Financial Ledgers | Full-Text Search, Logs, AI Vectors |
| **Indexing** | B-Tree (Great for exact matches/IDs) | Inverted Index (Great for unstructured text) |
| **Consistency** | **Strong (ACID)** - Instantly consistent | **Eventual (Near Real-Time)** - ~1s delay |
| **Scaling** | Vertical (Bigger server) | **Horizontal** (More servers / Shards) |
| **Ranking/Scoring** | Poor/Basic | **Advanced (BM25)** - Ranks by relevance |

**Trade-off Summary:** OpenSearch sacrifices strict ACID consistency (it takes ~1 second for an ingested document to become searchable) and requires managing a complex distributed cluster. In return, it provides sub-second, relevancy-scored search across billions of text documents—something PostgreSQL simply cannot do.

---

### Real-World Application: The DocViewer Project

In the `tai-portal` ecosystem, the **DocViewer** project handles millions of multi-page legal and financial documents. 

**The Pipeline:**
1. A user uploads a PDF. 
2. The file goes to Blob Storage (S3).
3. A background worker (using AWS Textract or similar OCR) extracts the raw text from the PDF.
4. The text is pushed to OpenSearch as a JSON document containing metadata (`TenantId`, `UploadDate`) and the `RawText`.

**The Search:**
When a user searches for "indemnity clause", we don't just want exact matches. OpenSearch's built-in **Analyzers** ensure that documents containing "indemnify" or "indemnification" are also returned. Furthermore, OpenSearch's **BM25 Algorithm** mathematically determines which document is *most relevant* based on Term Frequency (how often the word appears in the doc) and Inverse Document Frequency (how rare the word is across all docs).

**Multi-Tenancy Security:**
Just like EF Core Global Query Filters, we must enforce zero-trust in OpenSearch. Our backend API intercepts every user search request and forcibly appends a strict boolean filter:
```json
// The backend modifies the user's query before sending it to OpenSearch
{
  "query": {
    "bool": {
      "must": [ { "match": { "RawText": "indemnity clause" } } ],
      "filter": [ { "term": { "TenantId": "123-abc" } } ] // Enforces Zero-Trust
    }
  }
}
```

---

## Interview Q&A

### L2: Relational DB vs Search Engine
**Difficulty:** L2 (Mid-Level)

**Question:** Why do we maintain both PostgreSQL and OpenSearch in our architecture? Why not just put everything in OpenSearch since it's so fast?

**Answer:** PostgreSQL and OpenSearch solve fundamentally different problems. PostgreSQL is an ACID-compliant relational database. It ensures that when money is transferred or a user is approved, the data is instantly consistent and safely committed to disk. OpenSearch is an Eventually Consistent search engine. It trades strict transactional safety for incredible horizontal scalability and textual search speed. We use PostgreSQL as the single source of truth for business data, and we sync unstructured/searchable data (like documents or logs) to OpenSearch.

---

### L3: Handling the NRT (Near Real-Time) Delay
**Difficulty:** L3 (Senior)

**Question:** OpenSearch has a "Refresh Interval" (usually 1 second), meaning a document isn't searchable the exact millisecond it is ingested. How do you design the UI/UX in the DocViewer project to handle this eventual consistency without confusing the user?

**Answer:** When a user uploads a document, the API saves the file to Blob Storage, dispatches an event to the background indexer, and immediately returns a `202 Accepted` (not 200 OK) with the new Document ID. The Angular frontend doesn't immediately query OpenSearch to refresh the list; instead, it optimistically adds the document to the top of the UI list in a "Processing..." state. We rely on a SignalR push notification from the background worker to tell the frontend when the OpenSearch index has finally refreshed, at which point the UI changes the status to "Ready."

---

### L3: Dealing with Mapping Explosions
**Difficulty:** L3 (Senior)

**Question:** In OpenSearch, what is a "Mapping Explosion," and how can it bring down a cluster in a multi-tenant system where users can define their own custom fields?

**Answer:** OpenSearch automatically infers the data type of new JSON fields and creates a mapping (schema) in memory. If you allow 1,000 tenants to dynamically inject their own custom JSON keys (e.g., `"Tenant_A_CustomField": "value"`), the cluster's mapping state will grow infinitely. This is called a Mapping Explosion, and it causes the cluster to run out of RAM and crash. To prevent this, you must either disable dynamic mapping (`"dynamic": "false"`) or use a structured Key-Value array pattern (e.g., `{"Key": "Tenant_A_CustomField", "Value": "value"}`) so the cluster only ever tracks two fields regardless of what the user inputs.

---

## Further Reading
- [OpenSearch Architecture Basics](https://opensearch.org/docs/latest/opensearch/index/)
- [Inverted Index Explained](https://www.elastic.co/guide/en/elasticsearch/guide/current/inverted-index.html)
- [The BM25 Scoring Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)

---

*Last updated: 2026-03-31*