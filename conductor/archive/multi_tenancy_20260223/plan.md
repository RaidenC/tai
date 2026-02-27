# Implementation Plan: Multi-Tenancy & Data Isolation

## Phase 1: Core Multi-tenancy Infrastructure (Backend)

### 1.1 Domain Foundation (The Building Blocks)
- [x] **Task:** Define `IMultiTenantEntity` marker interface in `Tai.Portal.Core.Domain.Interfaces`. (c6fa21a)
- [x] **Task:** Update existing entities (`ApplicationUser`, `Tenant`) to implement `IMultiTenantEntity`. (c6fa21a)

### 1.2 Tenant Resolution (The Discovery Layer)
- [x] **Task (RED):** Write unit test for `TenantResolutionMiddleware` verifying host-to-tenant mapping. (dcd8227)
- [x] **Task (GREEN):** Implement `ITenantService` (Scoped) with `TenantId` and `IsGlobalAccess` flag. (dcd8227)
- [x] **Task (GREEN):** Implement `TenantResolutionMiddleware` with `IMemoryCache` (The "Notebook") for performance. (dcd8227)
- [x] **Task:** Register middleware and services in `portal-api/Program.cs`. (dcd8227)

### 1.3 Persistence Isolation (The Secure-by-Default Layer)
- [x] **Task (RED):** Write integration test verifying that `PortalDbContext` returns only current tenant data. (86b4e00)
- [x] **Task (GREEN):** Implement **Reflection-Based** Global Query Filters in `OnModelCreating` (The "Safety Net"). (86b4e00)
- [x] **Task (RED):** Write test verifying automatic `TenantId` injection on Save. (86b4e00)
- [x] **Task (GREEN):** Implement `TenantInterceptor` for automatic `TenantId` assignment. (86b4e00)
- [x] **Task:** Implement `IsGlobalAccess` logic in the query filter to allow System Admin overrides. (86b4e00)

- [x] **Conductor - User Manual Verification 'Phase 1: Core Multi-tenancy Infrastructure'** (6865c67)

## Phase 2: PostgreSQL Integration (The Portable Persistence Layer)

- [x] **Task:** Switch `portal-api` from In-Memory to PostgreSQL using `Npgsql`. (2c825cb)
- [x] **Task:** Add `Hostname` property to `Tenant` entity. (dcd8227)
- [x] **Task:** Create and apply initial migration for PostgreSQL schema. (d283604)
- [x] **Task:** Update `SeedData` with multiple tenants and distinct hostnames for testing. (f5c9be1)

- [x] **Conductor - User Manual Verification 'Phase 2: PostgreSQL Integration'** (12fdfae)

## Phase 3: Gateway & E2E Verification (The "Front Door" Trust)

- [x] **Task:** Configure **YARP Gateway Trust** validation in `portal-api` (The "Caller ID" check). (12fdfae)
- [x] **Task:** Configure YARP in `portal-gateway` to forward `X-Tenant-Host` securely. (dcc3d49)
- [x] **Task:** Write Playwright E2E test simulating requests from different hostnames and verifying data isolation. (f674b11)

- [x] **Conductor - User Manual Verification 'Phase 3: Gateway & E2E Verification'** (f674b11)

## Phase: Review Fixes
- [x] Task: Apply review suggestions (ed72698)
