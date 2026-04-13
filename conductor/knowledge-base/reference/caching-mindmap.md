---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 10
---
# 1. Caching Strategies

## **1.1. Caching Fundamentals**
1. Why Caching Exists
   - Trades memory + staleness for latency reduction (10,000x faster than DB)
   - Every layer: browser → CDN → gateway → app → database
2. Cache-Aside (Lazy Loading)
   - App checks cache, on miss fetches from DB and populates
   - tai-portal pattern: PrivilegeService, TenantResolutionMiddleware
   - Risk: cold start penalty, cache stampede on expiry
3. Write-Through & Write-Behind
   - Write-through: update DB + cache simultaneously (strong consistency)
   - Write-behind: update cache, async flush to DB (data loss risk)
4. Cache Invalidation
   - TTL expiration: simple but guarantees staleness
   - Explicit invalidation: precise but couples write path to cache structure
   - Event-driven: decoupled but adds infrastructure complexity
5. TTL vs Event-Driven Invalidation
   - TTL for reference data (tenant hostnames, config)
   - Events for security-sensitive data (privileges, roles)

## **1.2. Server-Side Caching (.NET)**
1. IMemoryCache (In-Process)
   - <1μs access, no serialization, no external dependency
   - tai-portal: privileges (10 min), tenant resolution (15 min), OTP codes
   - Not shared across instances, lost on restart
2. IDistributedCache & Redis
   - Shared across all API instances via external Redis server
   - ~0.5-2ms network round-trip + serialization cost
   - AWS: ElastiCache for Redis ($12-150/month)
3. Output Caching Middleware (.NET 8+)
   - Caches entire HTTP responses, short-circuits the full pipeline
   - Tag-based invalidation: EvictByTagAsync
   - Dangerous in multi-tenant: must Vary by tenant header
4. MediatR CachingBehavior Pipeline
   - Cross-cutting cache via IPipelineBehavior
   - ICacheableQuery marker interface for opt-in
   - Record value equality = deterministic cache keys

## **1.3. Frontend Caching (Angular)**
1. RxJS shareReplay & Memoization
   - Multicasts observable, replays last value to late subscribers
   - tai-portal: auth.service.ts user$ with shareReplay(1)
   - refCount: true for auto-cleanup when no subscribers
2. Signal Store Caching
   - Synchronous reactive cache with fine-grained updates
   - tai-portal: notification store with event deduplication (max 1000 IDs)
   - Memory-only, lost on page refresh
3. HTTP Interceptor Caching
   - Cross-cutting GET response cache by URL
   - Must invalidate on mutations
4. Service Worker & PWA Caching
   - Browser-managed proxy, enables offline-first
   - Disk-persistent, survives page refresh
   - Cache invalidation is extremely hard (stale deployments)

## **1.4. Database & Query Caching**
1. EF Core Query Plan Caching
   - Auto-caches LINQ → SQL translation
   - Dynamic filter combinations break plan cache (each shape = new entry)
   - EF.CompileAsyncQuery for hot-path queries
2. PostgreSQL Buffer Cache
   - shared_buffers: 25% of RAM (default 128MB is too low)
   - Hit ratio should be >99% for OLTP workloads
3. Materialized Views
   - Precomputed query results stored as physical tables
   - REFRESH CONCURRENTLY avoids read locks
   - Ideal for dashboard aggregations, reporting

## **1.5. Infrastructure Caching**
1. HTTP Cache Headers
   - Cache-Control: public/private, max-age, no-store
   - ETag + If-None-Match for conditional requests (304 Not Modified)
   - tai-portal: ETag on UsersController for optimistic concurrency
2. CDN Caching (CloudFront)
   - Edge locations reduce latency 200ms → 20ms for static assets
   - Content-hashed filenames avoid invalidation cost
   - Never cache tenant-scoped API responses at CDN
3. Reverse Proxy Caching (YARP)
   - Gateway-level output cache protects all downstream services
   - Must Vary by X-Tenant-Id header
   - Double caching risk if both gateway and API cache

## **1.6. Architecture & Cache Topology**
1. The Caching Pyramid
   - Client → CDN → Gateway → App → Database
   - Closer to client = faster but harder to invalidate
2. Multi-Tenant Cache Isolation
   - Every cache key must be scoped to tenant ID
   - TenantAwareCacheKeyProvider enforces prefix automatically
   - Cache size grows linearly with tenant count
