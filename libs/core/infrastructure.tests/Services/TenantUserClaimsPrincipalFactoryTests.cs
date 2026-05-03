using System;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Moq;
using Tai.Portal.Api.Services;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Services;

public class TenantUserClaimsPrincipalFactoryTests {
  [Fact]
  public async Task CreateAsync_AddsTenantIdClaim() {
    var tenantId = new TenantId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
    var user = new ApplicationUser("admin@tai.com", tenantId) {
      Email = "admin@tai.com"
    };

    var userManagerMock = new Mock<UserManager<ApplicationUser>>(
      Mock.Of<IUserStore<ApplicationUser>>(),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null);
    userManagerMock.Setup(m => m.GetUserIdAsync(user)).ReturnsAsync(user.Id);
    userManagerMock.Setup(m => m.GetUserNameAsync(user)).ReturnsAsync(user.UserName);
    userManagerMock.SetupGet(m => m.SupportsUserRole).Returns(false);
    userManagerMock.SetupGet(m => m.SupportsUserSecurityStamp).Returns(false);

    var roleManagerMock = new Mock<RoleManager<IdentityRole>>(
      Mock.Of<IRoleStore<IdentityRole>>(),
      null,
      null,
      null,
      null);

    var factory = new TenantUserClaimsPrincipalFactory(
      userManagerMock.Object,
      roleManagerMock.Object,
      Options.Create(new IdentityOptions()));

    var principal = await factory.CreateAsync(user);

    principal.FindFirst("tenant_id")?.Value.Should().Be(tenantId.Value.ToString());
  }
}
