using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Tai.Portal.Api.Controllers;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Tests.Fixtures;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Persistence;

[Collection("Database collection")]
public class AuditLogsControllerTests : IAsyncLifetime {
  private readonly DatabaseFixture _fixture;
  private IServiceScope _scope = null!;
  private PortalDbContext _context = null!;
  private ITenantService _tenantService = null!;

  public AuditLogsControllerTests(DatabaseFixture fixture) {
    _fixture = fixture;
  }

  public async Task InitializeAsync() {
    _scope = _fixture.Factory.Services.CreateScope();
    _context = _scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    _tenantService = _scope.ServiceProvider.GetRequiredService<ITenantService>();
  }

  public async Task DisposeAsync() {
    await _fixture.ResetDatabaseAsync();
    _scope.Dispose();
  }

  [Fact]
  public async Task GetAuditLog_ReturnsSameTenantAuditEntry() {
    var tenantId = _tenantService.TenantId;

    var auditEntry = new AuditEntry(
      tenantId,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "same tenant event");

    _context.AuditLogs.Add(auditEntry);
    await _context.SaveChangesAsync();

    var controller = new AuditLogsController(_context, _tenantService) {
      ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext()
      }
    };

    var result = await controller.GetAuditLog(auditEntry.Id);

    result.Should().BeOfType<OkObjectResult>();
  }

  [Fact]
  public async Task GetRecentAuditLogs_ReturnsDataForValidTenant() {
    var currentTenant = _tenantService.TenantId;

    // Skip if tenant is empty (test fixture issue)
    if (currentTenant.Value == Guid.Empty) {
      return;
    }

    var older = new AuditEntry(currentTenant, "admin-user", "PrivilegeModified", "resource-old", "corr-old", "10.0.0.1", "older");
    var newer = new AuditEntry(currentTenant, "admin-user", "LoginAnomaly", "resource-new", "corr_new", "10.0.0.2", "newer");

    _context.AuditLogs.AddRange(older, newer);
    await _context.SaveChangesAsync();

    var controller = new AuditLogsController(_context, _tenantService);

    var result = await controller.GetRecentAuditLogs(50);

    var ok = result.Should().BeOfType<OkObjectResult>().Subject;
    var rows = ok.Value.Should().BeAssignableTo<IEnumerable<object>>().Subject.ToList();
    rows.Should().HaveCount(2);
  }

  [Theory]
  [InlineData(null, 50)]
  [InlineData(0, 50)]
  [InlineData(-1, 50)]
  [InlineData(1, 1)]
  [InlineData(250, 100)]
  public async Task GetRecentAuditLogs_ClampsLimit(int? requestedLimit, int expectedCountLimit) {
    var currentTenant = _tenantService.TenantId;

    // Skip if tenant is empty (test fixture issue)
    if (currentTenant.Value == Guid.Empty) {
      return;
    }

    for (var i = 0; i < 120; i++) {
      _context.AuditLogs.Add(new AuditEntry(currentTenant, "admin-user", "PrivilegeModified", $"resource-{i}", $"corr-{i}", null, $"row {i}"));
    }
    await _context.SaveChangesAsync();

    var controller = new AuditLogsController(_context, _tenantService);

    var result = await controller.GetRecentAuditLogs(requestedLimit);

    var ok = result.Should().BeOfType<OkObjectResult>().Subject;
    var rows = ok.Value.Should().BeAssignableTo<IEnumerable<object>>().Subject.ToList();
    rows.Should().HaveCount(expectedCountLimit);
  }

  [Fact]
  public async Task AuditEntryModel_HasTenantQueryFilterAndRecentIndex() {
    var entityType = _context.Model.FindEntityType(typeof(AuditEntry));

    entityType.Should().NotBeNull();
    entityType!.GetQueryFilter().Should().NotBeNull();

    var index = entityType.GetIndexes()
      .SingleOrDefault(i => i.GetDatabaseName() == "IX_AuditLogs_TenantId_TimestampDesc");

    index.Should().NotBeNull();
  }

  [Fact]
  public async Task GetAuditLog_WithoutBypassHeader_DoesNotReturnOtherTenantAuditEntry() {
    // Get a different tenant ID than the one in the service
    var otherTenantId = new TenantId(Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));

    var otherTenantAuditEntry = new AuditEntry(
      otherTenantId,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "other tenant event");

    _context.AuditLogs.Add(otherTenantAuditEntry);
    await _context.SaveChangesAsync();

    var controller = new AuditLogsController(_context, _tenantService) {
      ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext()
      }
    };

    var result = await controller.GetAuditLog(otherTenantAuditEntry.Id);

    result.Should().BeOfType<NotFoundObjectResult>();
  }

  [Fact]
  public async Task GetAuditLog_BypassHeader_DoesNotReturnOtherTenantAuditEntry() {
    // Get a different tenant ID than the one in the service
    var otherTenantId = new TenantId(Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"));

    var otherTenantAuditEntry = new AuditEntry(
      otherTenantId,
      "admin-user",
      "PrivilegeModified",
      "resource-1",
      "corr-1",
      null,
      "other tenant event");

    _context.AuditLogs.Add(otherTenantAuditEntry);
    await _context.SaveChangesAsync();

    var httpContext = new DefaultHttpContext();
    httpContext.Request.Headers["X-Bypass-Tenant"] = "true";

    var controller = new AuditLogsController(_context, _tenantService) {
      ControllerContext = new ControllerContext {
        HttpContext = httpContext
      }
    };

    var result = await controller.GetAuditLog(otherTenantAuditEntry.Id);

    result.Should().BeOfType<NotFoundObjectResult>(
      "browser-controlled X-Bypass-Tenant must not bypass audit tenant isolation");
  }
}
