using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence.Interceptors;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;

namespace Tai.Portal.Core.Infrastructure.Persistence;

public partial class PortalDbContext : IdentityDbContext<ApplicationUser> {
  private readonly ILogger<PortalDbContext>? _logger;
  private readonly List<Func<CancellationToken, Task>> _postCommitActions = new();
  private readonly ITenantService _tenantService;
  private readonly IServiceProvider _serviceProvider;

  public TenantId CurrentTenantId => _tenantService.TenantId;
  public bool IsGlobalAccess => _tenantService.IsGlobalAccess;

  public DbSet<Tenant> Tenants { get; set; }
  public DbSet<AuditEntry> AuditLogs { get; set; }
  public DbSet<Privilege> Privileges { get; set; }
  public DbSet<UserPrivilege> UserPrivileges { get; set; }
  public DbSet<OutboxMessage> OutboxMessages { get; set; }

  public PortalDbContext(
      DbContextOptions<PortalDbContext> options,
      ITenantService tenantService,
      IServiceProvider serviceProvider,
      ILogger<PortalDbContext>? logger = null)
      : base(options) {
    _tenantService = tenantService;
    _serviceProvider = serviceProvider;
    _logger = logger;
  }

  /// <summary>
  /// Registers a callback to execute AFTER the current Unit of Work commits successfully.
  /// Cleared automatically on rollback so nothing fires for a failed transaction.
  /// </summary>
  /// <remarks>
  /// JUNIOR RATIONALE (Post-commit side effects):
  /// Any side effect that should happen "only if the DB write succeeded"
  /// (SignalR push, email send, external API call) MUST be registered here,
  /// NOT called inline in a handler. Inline calls happen BEFORE commit, so
  /// they fire even when the transaction later fails — same dual-write
  /// hazard the outbox pattern exists to fix.
  /// </remarks>
  public void RegisterPostCommitAction(Func<CancellationToken, Task> action) {
    _postCommitActions.Add(action);
  }

  /// <summary>
  /// Unit-of-Work orchestrator: wraps the entire save-dispatch-commit cycle in a transaction,
  /// dispatches domain events AFTER the first base.SaveChangesAsync, and runs post-commit
  /// actions only on successful commit.
  /// </summary>
  public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) {
    // Pre-flight: reject post-commit actions inside caller-managed transactions.
    if (Database.CurrentTransaction != null) {
      if (_postCommitActions.Count > 0) {
        throw new InvalidOperationException(
          "Post-commit actions cannot be used inside a caller-managed transaction. " +
          "Use the DbContext-owned transaction pattern instead.");
      }
      // Fall through to base behavior for caller-managed transactions.
      PopulateAuditFields();
      await DispatchDomainEventsAsync(cancellationToken);
      return await base.SaveChangesAsync(cancellationToken);
    }

    // UoW orchestration: wrap in transaction, save first, dispatch, save again if needed, commit, then post-commit.
    var isRelational = Database.IsRelational();
    if (!isRelational) {
      // For in-memory databases, skip transaction wrapping but still run full orchestration.
      PopulateAuditFields();
      var result = await base.SaveChangesAsync(cancellationToken);
      await DispatchDomainEventsAsync(cancellationToken);
      if (ChangeTracker.HasChanges()) {
        await base.SaveChangesAsync(cancellationToken);
      }
      await ExecutePostCommitActionsAsync(cancellationToken);
      return result;
    }

    await using var dbTransaction = await Database.BeginTransactionAsync(cancellationToken);
    try {
      // 1. Populate audit fields
      PopulateAuditFields();

      // 2. First save: persist aggregate root changes
      var result = await base.SaveChangesAsync(cancellationToken);

      // 3. Dispatch events AFTER first save
      await DispatchDomainEventsAsync(cancellationToken);

      // 4. Second save: persist any new entities created by handlers
      if (ChangeTracker.HasChanges()) {
        await base.SaveChangesAsync(cancellationToken);
      }

      // 5. Commit transaction
      await dbTransaction.CommitAsync(cancellationToken);

      // 6. Execute post-commit actions (outside the transaction)
      await ExecutePostCommitActionsAsync(cancellationToken);

      return result;
    } catch {
      // Rollback is implicit on exception — DbContext disposes the transaction.
      // Post-commit actions must NOT run on failure.
      _postCommitActions.Clear();
      throw;
    }
  }

  private async Task ExecutePostCommitActionsAsync(CancellationToken cancellationToken) {
    if (_postCommitActions.Count == 0) return;

    var actions = _postCommitActions.ToList();
    _postCommitActions.Clear();

    foreach (var action in actions) {
      try {
        await action(cancellationToken);
      } catch (Exception ex) {
        // Log but do not re-throw — the DB work already committed.
        _logger?.LogError(ex, "Post-commit action failed");
      }
    }
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
        .Entries()
        .Where(e => e.Entity is IHasDomainEvents hasEvents && hasEvents.DomainEvents.Any())
        .Select(e => (IHasDomainEvents)e.Entity)
        .ToList();

    if (!entities.Any()) return;

    var publisher = _serviceProvider.GetService(typeof(IPublisher)) as IPublisher;
    if (publisher == null) return;

    var domainEvents = entities
        .SelectMany(e => e.DomainEvents)
        .ToList();

    entities.ForEach(e => e.ClearDomainEvents());

    foreach (var domainEvent in domainEvents) {
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
      // Partitioning Requirement: The partition key (Timestamp) must be part of the Primary Key.
      b.HasKey(a => new { a.Id, a.Timestamp });

      b.Property(a => a.TenantId).HasConversion(
          tenantId => tenantId.Value,
          value => new TenantId(value));

      b.Property(a => a.Action).IsRequired();
      b.Property(a => a.UserId).IsRequired();
      b.Property(a => a.ResourceId).IsRequired();
      b.Property(a => a.Timestamp).IsRequired();

      // Supporting the fast "Claim Check" lookups by Id alone
      b.HasIndex(a => a.Id)
       .HasDatabaseName("IX_AuditLogs_Id");

      // Index for contextual dashboard lookups (Tenant + User + Chronological)
      b.HasIndex(a => new { a.TenantId, a.UserId, a.Timestamp })
       .IsDescending(false, false, true)
       .HasDatabaseName("IX_AuditLogs_TenantId_UserId_TimestampDesc");

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

    // Configure UserPrivilege
    builder.Entity<UserPrivilege>(b => {
      b.HasKey(up => new { up.UserId, up.PrivilegeId });

      b.Property(up => up.PrivilegeId).HasConversion(
          id => id.Value,
          value => new PrivilegeId(value));

      b.HasOne<ApplicationUser>()
        .WithMany()
        .HasForeignKey(up => up.UserId)
        .IsRequired()
        .OnDelete(DeleteBehavior.Cascade);

      b.HasOne<Privilege>()
        .WithMany()
        .HasForeignKey(up => up.PrivilegeId)
        .IsRequired()
        .OnDelete(DeleteBehavior.Cascade);
    });

    // Configure OutboxMessage — Transactional Outbox pattern (Stage 1B).
    builder.Entity<OutboxMessage>(b => {
      b.HasKey(m => m.Id);
      b.Property(m => m.EventType).IsRequired().HasMaxLength(512);
      b.Property(m => m.Payload).HasColumnType("jsonb").IsRequired();
      b.Property(m => m.OccurredAt).IsRequired();
      b.Property(m => m.Error).HasMaxLength(2000);

      // JUNIOR RATIONALE (Partial Index):
      // The publisher worker ONLY queries unprocessed rows
      // (ProcessedAt IS NULL). A partial index is ~99% smaller than a
      // full index on a table that's mostly processed history. Fast
      // lookup on hot rows, tiny write overhead since the index entry
      // only exists while the row is unprocessed and is removed when
      // ProcessedAt transitions null -> timestamp.
      b.HasIndex(m => m.OccurredAt)
       .HasFilter("\"ProcessedAt\" IS NULL")
       .HasDatabaseName("IX_OutboxMessages_Unprocessed");

      // No multi-tenant query filter — outbox is an infrastructure-level
      // table; the worker reads it as System.
    });
  }
}
