# Research: Multi-Tenancy & Data Isolation

## 1. Current State Analysis

### 1.1 Tenant Identity
- **Value Object:** `TenantId` is implemented as a `readonly record struct` in `Tai.Portal.Core.Domain.ValueObjects`. It wraps a `Guid`.
- **Entities:** `ApplicationUser` and `Tenant` already include `TenantId`.
- **Invariants:** `ApplicationUser` uses C# 14 `field` keyword in its `init` accessor to ensure a valid `TenantId` is provided during initialization.

### 1.2 Persistence Layer (`PortalDbContext`)
- **Type Conversions:** The `DbContext` already configures a `ValueConverter` for `TenantId` to `Guid` mapping.
- **Missing Features:**
    - No Global Query Filters are currently applied.
    - No mechanism for automatic `TenantId` injection on Save.
    - Currently uses `UseInMemoryDatabase`.

### 1.3 Request Flow & Resolution
- **Gateway (YARP):** `portal-gateway` appends `X-Forwarded` headers.
- **API:** `portal-api` uses `app.UseForwardedHeaders()`, which should make the original `Host` available in `HttpContext.Request.Host`.
- **Resolution Strategy:** We resolve the tenant by matching `Request.Host` against a `Hostname` property in the `Tenants` table.

## 2. Proposed Architectural Changes

### 2.1 Domain Layer
- **Marker Interface:** Define `IMultiTenantEntity` as a marker. While we will use reflection for the global filter, this interface remains useful for generic constraints in repositories.

### 2.2 Infrastructure Layer
- **`ITenantService` (The Source of Truth):** 
    - A scoped service holding the current `TenantId`.
    - Includes an `IsGlobalAccess` flag (The "Master Key") to allow System Admins to bypass filters for reporting/maintenance.
- **`TenantResolutionMiddleware`:**
    - Extracts host from `HttpContext`.
    - **Optimization:** Uses `IMemoryCache` to store Hostname-to-TenantId mappings to avoid per-request database hits.
    - **Security:** Implements "Trusted Gateway" validation—only trusts headers if the request originates from the YARP Gateway's IP or carries a shared secret.

### 2.3 Persistence Layer
- **Reflection-Based Filters (Secure by Default):** Instead of manually applying filters, `OnModelCreating` will iterate over all registered entity types and apply `HasQueryFilter` to any class containing a `TenantId` property. This approach provides database portability.
- **`TenantInterceptor` (EF Core):** Automatically sets `TenantId` on entities during `SaveChanges`.

## 3. Production Hardening Recommendations (Future Phase)
- **PostgreSQL Row-Level Security (RLS):** As a "Defense in Depth" measure for production, we recommend configuring Postgres RLS policies. Even if EF Core filters are bypassed (e.g., via raw SQL), the database itself will reject unauthorized row access. This adds significant reliability but introduces database vendor lock-in.

## 4. Risks & Considerations
- **Spoofing:** If the API is exposed directly to the internet, `X-Forwarded-Host` can be forged. Gateway validation is mandatory.
- **Filter Bypassing:** Calls like `.IgnoreQueryFilters()` can leak data. In production, RLS acts as the final safety net.
- **Cache Invalidation:** If a tenant's hostname changes, the `IMemoryCache` must be cleared or use a short TTL.

## 5. Next Steps
- Implement the `ITenantService` with `IsGlobalAccess` support.
- Transition to PostgreSQL schema.
- Configure YARP trust validation.
