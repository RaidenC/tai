# API Design & REST — Mindmap

## 1. REST Principles
### 1.1 Richardson Maturity Model
- Level 0: Single endpoint, RPC over HTTP
- Level 1: Resources with unique URIs
- Level 2: Proper HTTP verbs + status codes ← tai-portal target
- Level 3: HATEOAS (hypermedia controls)

### 1.2 Resource Naming & HTTP Verbs
- Nouns not verbs: `/api/users`
- GET (read), POST (create), PUT (full replace), PATCH (partial), DELETE
- Plural nouns, kebab-case, max 2-level nesting
- Sub-resource for actions: `POST /api/users/{id}/approve`

### 1.3 Status Codes — The Contract
- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
- 409 Conflict, 422 Unprocessable Entity
- 429 Too Many Requests, 500 Internal Server Error, 502/503

---

## 2. API Lifecycle
### 2.1 Versioning Strategies
- URL path: `/api/v2/users` ← simplest
- Header: `Api-Version: 2`
- Media type: `Accept: application/vnd.portal.v2+json`

### 2.2 OpenAPI / Swagger
- Standard API documentation
- Generates Swagger UI, client SDKs
- ASP.NET Core 10: `AddOpenApi()`

### 2.3 Deprecation & Sunset Headers
- Sunset header (RFC 8594): removal date
- Deprecation header: marks endpoint deprecated
- Link header: points to successor version

---

## 3. Query Patterns
### 3.1 Pagination — Offset vs Cursor/Keyset
- **Offset**: `?page=3&pageSize=20` → `OFFSET 40 LIMIT 20`
  - Pros: Random access, total count
  - Cons: Degrades at scale, duplicates with inserts
- **Keyset**: `?after=lastId` → `WHERE id > lastId`
  - Pros: O(1) performance, stable cursor
  - Cons: No random access, no total count

### 3.2 Filtering, Sorting & Sparse Fieldsets
- Filtering: `?status=Active&role=Admin`
- Sorting: `?sort=createdAt:desc`
- Sparse fieldsets: `?fields=id,email,status`
- Whitelist allowed fields (SQL injection prevention)

### 3.3 Bulk Operations
- `POST /api/users/bulk-approve`
- Per-item results: succeeded + failed
- Best-effort (partial success) vs atomic

---

## 4. Reliability & Contracts
### 4.1 RFC 9457 Problem Details
- Standard error format: `application/problem+json`
- Fields: type, title, status, detail, instance
- Extensions: traceId, errors

### 4.2 Idempotency Keys
- Client generates: `Idempotency-Key: uuid`
- Server caches response for 24h
- Prevents duplicate resources on retry

### 4.3 Rate Limiting & Content Negotiation
- Rate limiting: 100 req/min per tenant
- Response headers: X-RateLimit-Limit, X-RateLimit-Remaining
- Content negotiation: `Accept: application/json`

---

## 5. Architecture & Data Flow
```
Angular SPA → YARP Gateway → Rate Limiter → API
                                  ↓
                            MediatR Handler
                                  ↓
                         Problem Details (error)
```

---

## 6. Real-World Examples
### 6.1 Problem Details Error
```json
{
  "type": "https://portal.tai.com/errors/validation",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "Email": ["Invalid email"] }
}
```

### 6.2 Paginated Response
```json
{
  "items": [...],
  "pageInfo": { "totalCount": 1500, "pageNumber": 3, "hasNextPage": true }
}
```

### 6.3 Idempotent POST
- Header: `Idempotency-Key: crypto.randomUUID()`
- Second request returns cached 201 response

---

## 7. Interview Q&A Summary
- **L1**: HTTP methods (GET/POST/PUT/PATCH/DELETE)
- **L2**: Offset vs cursor pagination trade-offs
- **L3**: RFC 9457 Problem Details for consistent errors
- **Staff**: API evolution without breaking clients (versioning, deprecation, contract testing)
