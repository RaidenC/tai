using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

/// <summary>
/// EF Core context for the Payment Protection bounded context.
/// Lives in the 'payment_protection' Postgres schema (separate from 'public'
/// which hosts PortalDbContext). Has its own __EFMigrationsHistory table inside
/// the same schema so the two contexts can evolve independently.
/// </summary>
public class PaymentProtectionDbContext : DbContext {
  public const string SchemaName = "payment_protection";

  public DbSet<ClaimDraft> ClaimDrafts => Set<ClaimDraft>();

  public PaymentProtectionDbContext(DbContextOptions<PaymentProtectionDbContext> options) : base(options) { }

  protected override void OnModelCreating(ModelBuilder modelBuilder) {
    base.OnModelCreating(modelBuilder);
    modelBuilder.HasDefaultSchema(SchemaName);
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(PaymentProtectionDbContext).Assembly);
  }
}
