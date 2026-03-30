using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class AuditLogPartitioningTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly TenantId TestTenantId = new(Guid.Parse("00000000-0000-0000-0000-000000000001"));

  public AuditLogPartitioningTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  [Fact]
  public async Task AuditLogs_ShouldSupportBulkInsert_AndBeQueryable() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

    // Clear existing test data to ensure deterministic count
    await dbContext.AuditLogs.IgnoreQueryFilters()
        .Where(a => a.UserId == "test-user")
        .ExecuteDeleteAsync();

    var logs = new List<AuditEntry>(); for (int i = 0; i < 100; i++) {
      logs.Add(new AuditEntry(
          TestTenantId,
          "test-user",
          "Test-Action",
          $"resource-{i}",
          "test-correlation",
          "127.0.0.1",
          $"Details for log {i}"
      ));
    }

    // Act
    dbContext.AuditLogs.AddRange(logs);
    await dbContext.SaveChangesAsync();

    // Assert
    var count = await dbContext.AuditLogs
        .IgnoreQueryFilters()
        .Where(a => a.TenantId == TestTenantId && a.UserId == "test-user" && a.Action == "Test-Action")
        .CountAsync();

    Assert.Equal(100, count);
  }

  [Fact]
  public async Task AuditLogs_ShouldSupportLookupById_AcrossPartitions() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

    var log = new AuditEntry(
        TestTenantId,
        "test-user",
        "Id-Lookup",
        "resource-1",
        "id-corr",
        "127.0.0.1",
        "Details"
    );
    var logId = log.Id;

    dbContext.AuditLogs.Add(log); await dbContext.SaveChangesAsync();

    // Act
    var retrieved = await dbContext.AuditLogs
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(a => a.Id == logId);

    // Assert
    Assert.NotNull(retrieved);
    Assert.Equal(logId, retrieved.Id);
  }

  [Fact]
  public async Task AuditLogs_ShouldHaveCompositeIndex_ForDashboardQueries() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

    // Act
    var entityType = dbContext.Model.FindEntityType(typeof(AuditEntry));
    var index = entityType?.GetIndexes().FirstOrDefault(i =>
        i.Properties.Any(p => p.Name == "UserId") &&
        i.Properties.Any(p => p.Name == "Timestamp") &&
        i.Properties.Any(p => p.Name == "TenantId"));

    // Assert
    Assert.NotNull(index);
    Assert.Equal("IX_AuditLogs_TenantId_UserId_TimestampDesc", index.GetDatabaseName());
  }

  [Fact]
  public async Task AuditLogs_PrimaryKey_ShouldIncludeTimestamp_ForPartitioning() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PortalDbContext>();

    // Act
    var entityType = dbContext.Model.FindEntityType(typeof(AuditEntry));
    var pk = entityType?.FindPrimaryKey();

    // Assert
    Assert.NotNull(pk);
    Assert.Contains(pk.Properties, p => p.Name == "Id");
    Assert.Contains(pk.Properties, p => p.Name == "Timestamp");
  }
}
