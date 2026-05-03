using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System;
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

    var controller = new AuditLogsController(_context) {
      ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext()
      }
    };

    var result = await controller.GetAuditLog(auditEntry.Id);

    result.Should().BeOfType<OkObjectResult>();
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

    var controller = new AuditLogsController(_context) {
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

    var controller = new AuditLogsController(_context) {
      ControllerContext = new ControllerContext {
        HttpContext = httpContext
      }
    };

    var result = await controller.GetAuditLog(otherTenantAuditEntry.Id);

    result.Should().BeOfType<NotFoundObjectResult>(
      "browser-controlled X-Bypass-Tenant must not bypass audit tenant isolation");
  }
}
