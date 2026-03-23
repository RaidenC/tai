using System;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;

namespace Tai.Portal.Core.Infrastructure.Persistence;

public partial class PortalDbContext : IdentityDbContext<ApplicationUser> {
  private readonly ITenantService _tenantService;
  private readonly IServiceProvider _serviceProvider;

  public TenantId CurrentTenantId => _tenantService.TenantId;
  public bool IsGlobalAccess => _tenantService.IsGlobalAccess;

  public DbSet<Tenant> Tenants { get; set; }
  public DbSet<AuditEntry> AuditLogs { get; set; }
  public DbSet<Privilege> Privileges { get; set; }

  public PortalDbContext(
      DbContextOptions<PortalDbContext> options,
      ITenantService tenantService,
      IServiceProvider serviceProvider)
      : base(options) {
    _tenantService = tenantService;
    _serviceProvider = serviceProvider;
  }

  public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) {
    // 1. Automatically populate audit fields for auditable entities
    PopulateAuditFields();

    // 2. Dispatch events BEFORE saving to allow handlers to join the transaction.
    await DispatchDomainEventsAsync(cancellationToken);

    return await base.SaveChangesAsync(cancellationToken);
  }

  private void PopulateAuditFields() {
    var entries = ChangeTracker.Entries<IAuditableEntity>();
    if (!entries.Any()) return;

    var currentUserService = _serviceProvider.GetService(typeof(ICurrentUserService)) as ICurrentUserService;
    var userId = currentUserService?.UserId ?? "System";
    var now = DateTimeOffset.UtcNow;

    foreach (var entry in entries) {
      if (entry.State == EntityState.Added) {
        entry.Entity.CreatedAt = now;
        entry.Entity.CreatedBy = userId;
      } else if (entry.State == EntityState.Modified) {
        entry.Entity.LastModifiedAt = now;
        entry.Entity.LastModifiedBy = userId;
      }
    }
  }

  private async Task DispatchDomainEventsAsync(CancellationToken cancellationToken) {
    var entities = ChangeTracker
        .Entries<IHasDomainEvents>()
        .Where(e => e.Entity.DomainEvents.Any())
        .Select(e => e.Entity)
        .ToList();

    var domainEvents = entities
        .SelectMany(e => e.DomainEvents)
        .ToList();

    if (!domainEvents.Any()) return;

    var publisher = _serviceProvider.GetService(typeof(IPublisher)) as IPublisher;
    if (publisher == null) return;

    entities.ForEach(e => e.ClearDomainEvents());

    foreach (var domainEvent in domainEvents) {
      // We wrap the DomainEvent in a DomainEventNotification<T> to satisfy MediatR's INotification constraint
      // without introducing MediatR as a dependency to our Domain layer.
      var notificationType = typeof(DomainEventNotification<>).MakeGenericType(domainEvent.GetType());
      var notification = Activator.CreateInstance(notificationType, domainEvent);
      if (notification != null) {
        await publisher.Publish(notification, cancellationToken);
      }
    }
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

      b.Property(u => u.ApprovedBy).HasConversion(
          adminId => adminId.HasValue ? adminId.Value.Value : null,
          value => value != null ? new TenantAdminId(value) : (TenantAdminId?)null)
        .HasColumnName("ApprovedByUserId");

      b.Property(u => u.RowVersion)
        .IsRowVersion();

      b.HasIndex(u => u.TenantId); // Optimizes the Global Query Filter

      b.HasQueryFilter(u => _tenantService.IsGlobalAccess || u.TenantId == _tenantService.TenantId);
    });

    // Configure AuditEntry
    builder.Entity<AuditEntry>(b => {
      b.HasKey(a => a.Id);
      b.Property(a => a.TenantId).HasConversion(
          tenantId => tenantId.Value,
          value => new TenantId(value));

      b.Property(a => a.Action).IsRequired();
      b.Property(a => a.UserId).IsRequired();
      b.Property(a => a.ResourceId).IsRequired();
      b.Property(a => a.Timestamp).IsRequired();

      // Satisfies the global query filter AND typical chronological sorting
      b.HasIndex(a => new { a.TenantId, a.Timestamp })
       .IsDescending(false, true)
       .HasDatabaseName("IX_AuditLogs_TenantId_TimestampDesc");

      // JUNIOR RATIONALE:
      // Audit logs are our safety net for "Who did what and when."
      // Since they are for compliance, they must be immutable.
      // Global query filtering ensures a tenant can only see their own logs.
      b.HasQueryFilter(a => _tenantService.IsGlobalAccess || a.TenantId == _tenantService.TenantId);
    });

    // Configure Privilege
    builder.Entity<Privilege>(b => {
      b.HasKey(p => p.Id);
      b.Property(p => p.Id).HasConversion(
          id => id.Value,
          value => new PrivilegeId(value));

      b.Property(p => p.Name).IsRequired().HasMaxLength(256);
      b.HasIndex(p => p.Name).IsUnique();

      b.Property(p => p.Module).IsRequired().HasMaxLength(128);
      b.HasIndex(p => p.Module); // Index for fast filtering by App/Module

      b.Property(p => p.RiskLevel).HasConversion<int>();

      // PostgreSQL JSONB support for complex types
      b.Property(p => p.JitSettings).HasColumnType("jsonb");
      b.Property(p => p.SupportedScopes).HasColumnType("jsonb");

      b.Property(p => p.RowVersion)
        .IsRowVersion()
        .HasColumnName("xmin")
        .HasColumnType("xid")
        .ValueGeneratedOnAddOrUpdate();

      // No Global Query Filter for Privilege as it is a global catalog.
    });
  }
}
