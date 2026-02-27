using System.Linq.Expressions;
using System.Reflection;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;

namespace Tai.Portal.Core.Infrastructure.Persistence;

public partial class PortalDbContext : IdentityDbContext<ApplicationUser> {
  private readonly ITenantService _tenantService;

  public TenantId CurrentTenantId => _tenantService.TenantId;
  public bool IsGlobalAccess => _tenantService.IsGlobalAccess;

  public DbSet<Tenant> Tenants { get; set; }

  public PortalDbContext(DbContextOptions<PortalDbContext> options, ITenantService tenantService)
      : base(options) {
    _tenantService = tenantService;
  }

  protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) {
    optionsBuilder.AddInterceptors(new TenantInterceptor());
    base.OnConfiguring(optionsBuilder);
  }

  protected override void OnModelCreating(ModelBuilder builder) {
    base.OnModelCreating(builder);

    // Tell EF Core to use the OpenIddict entities.
    builder.UseOpenIddict();

    // Configure Tenant
    builder.Entity<Tenant>(b => {
      b.HasKey(t => t.Id);
      b.Property(t => t.Id).HasConversion(
          tenantId => tenantId.Value,
          value => new TenantId(value));

      b.Ignore(t => t.AssociatedTenantId);
      b.Property(t => t.Name).IsRequired();
      b.Property(t => t.TenantHostname).IsRequired();
      b.HasIndex(t => t.TenantHostname).IsUnique();

      // JUNIOR RATIONALE (Global Query Filter):
      // This is our "Safety Net." It automatically adds "WHERE TenantId = ..." 
      // to every query you write. You don't have to remember to filter data; 
      // the database engine does it for you.
      b.HasQueryFilter(t => _tenantService.IsGlobalAccess || t.Id == _tenantService.TenantId);
    });

    // Configure ApplicationUser
    builder.Entity<ApplicationUser>(b => {
      b.Property(u => u.TenantId).HasConversion(
          tenantId => tenantId.Value,
          value => new TenantId(value));

      b.HasQueryFilter(u => _tenantService.IsGlobalAccess || u.TenantId == _tenantService.TenantId);
    });
  }
}
