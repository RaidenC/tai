# Specification: Multi-Tenancy & Data Isolation

## Overview
Implement a robust, host-based multi-tenancy system that ensures strict data isolation at the persistence layer using EF Core Global Query Filters and PostgreSQL.

## Core Requirements
1. **Host-Based Resolution:** Resolve the active `TenantId` based on the incoming request's `Host` header or a custom `X-Tenant-Host` header passed from the YARP gateway.
2. **Context-Aware Persistence:** Automatically inject the resolved `TenantId` into every database operation.
3. **EF Core Global Query Filters:** Enforce logical data isolation across all tenant-specific entities to prevent cross-tenant data leaks.
4. **Tenant-Specific Metadata:** Maintain a registry of valid tenants and their associated hostnames.

## Technical Details
- **Tenant Resolution Service:** An `ITenantService` in the Infrastructure layer that extracts the tenant context from `IHttpContextAccessor`.
- **Global Query Filters:** Implement `HasQueryFilter` in `PortalDbContext` to automatically filter results by `TenantId`.
- **Automatic Multi-tenancy Injections:** Override `SaveChangesAsync` to ensure that newly created entities are automatically tagged with the current `TenantId`.

## Success Criteria
- [ ] Requests to different hostnames successfully resolve to different `TenantId` values.
- [ ] Database queries automatically include `WHERE "TenantId" = @tenant_id`.
- [ ] Attempting to access data from another tenant returns an empty result set (or 404).
- [ ] Integration tests verify that data is never leaked between two distinct tenants.
