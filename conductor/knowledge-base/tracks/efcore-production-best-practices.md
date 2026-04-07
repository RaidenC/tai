# EF Core Production-Ready Refactoring Notes

This document contains best practices and architectural adjustments needed to transition the current `tai.portal` POC's Entity Framework Core implementation to a production-ready standard. 

We will address these action items in a future refactoring phase.

## 1. Entity Configuration Refactoring
**Current State:** All entity configurations (`HasQueryFilter`, `HasIndex`, `HasConversion`) are defined directly inside `PortalDbContext.OnModelCreating(builder)`. This creates a massive, unmaintainable file.

**Action Item:** Extract the configuration for each entity into its own dedicated class implementing `IEntityTypeConfiguration<T>`.

**Example:**
```csharp
// libs/core/infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.TenantId)
               .HasConversion(id => id.Value, value => new TenantId(value));
        
        builder.Property(u => u.RowVersion).IsRowVersion();
        builder.HasIndex(u => u.TenantId);
    }
}
```

**DbContext Update:**
Replace the individual configurations in `OnModelCreating` with automatic assembly scanning:
```csharp
protected override void OnModelCreating(ModelBuilder builder)
{
    base.OnModelCreating(builder);
    builder.ApplyConfigurationsFromAssembly(typeof(PortalDbContext).Assembly);
}
```
*(Note: Global query filters closing over scoped services are the one exception that often still need to be registered in `OnModelCreating` directly.)*

---

## 2. Seed Data Refactoring
**Current State:** A massive `SeedData.InitializeAsync` script runs on application startup, protected by an advisory lock.

**Action Item:** Split seeding into two distinct categories:

1. **Static/Lookup Data (Managed by EF Core Migrations):**
   For data that rarely changes and is required for the system to function (e.g., standard System Roles, default configuration keys), use the `HasData()` method inside your `IEntityTypeConfiguration`. This bakes the data into your migration files so it is version-controlled exactly like schema changes.
   ```csharp
   builder.HasData(new Role { Id = 1, Name = "SuperAdmin" });
   ```
2. **Dynamic/Environment Data (Managed by a Hosted Service):**
   For data that requires external services, dynamic password hashing (like creating a default Admin user), or environment-specific test data, use a dedicated Migration/Seeding Background Service. This service runs independently of the API web host (often as an init container in Kubernetes or an Aspire component) to ensure the app doesn't accept traffic until the database is ready.

---

## 3. Migration Execution Strategy
**Current State:** Migrations are likely generated and applied on startup via `context.Database.MigrateAsync()`.

**Action Item:** Stop applying migrations on application startup in the production web API. Multiple pods spinning up simultaneously can cause race conditions or database locks, even with advisory locks.

**Target Implementation (Choose one for CI/CD):**
*   **Option A (CI/CD Driven):** Generate SQL scripts using `dotnet ef migrations script --idempotent` and have the CI/CD pipeline run the script against the database before deploying the application code.
*   **Option B (Migration Bundles):** Use `dotnet ef migrations bundle` to create a self-contained executable that applies migrations.
*   **Option C (Dedicated Migration Worker):** Create a separate .NET Worker project that runs `MigrateAsync()`. In Kubernetes, this runs as an `initContainer` or a pre-install Helm hook.

---

## Reference: How EF Core Migrations Run

Migrations are executed in strict chronological order, not just "the ones in the PR."

1. **The History Table:** EF Core creates a special table in the database called `__EFMigrationsHistory`. This table stores the string name of every migration that has *already* been successfully applied.
2. **The Comparison:** When running the update command (or `MigrateAsync`), EF Core reflects over the compiled assembly to find all migration classes and queries the `__EFMigrationsHistory` table.
3. **The Execution:** It identifies any migrations in the assembly that are *missing* from the history table and orders them sequentially by their timestamp prefix.
4. **The Application:** It runs the `Up()` method of each missing migration, one by one, in order. After each successful execution, it inserts a new row into `__EFMigrationsHistory`.

Older migrations already recorded in the history table are safely ignored.