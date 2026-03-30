using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class OidcClientRegistrationTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;

  public OidcClientRegistrationTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  [Fact]
  public async Task PortalWebClient_IsProperlyRegistered() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

    // Act
    var client = await manager.FindByClientIdAsync("portal-web");

    // Assert
    Assert.NotNull(client);

    var descriptor = new OpenIddictApplicationDescriptor();
    await manager.PopulateAsync(descriptor, client);

    Assert.Equal("portal-web", descriptor.ClientId);
    Assert.Equal("Portal Web Application", descriptor.DisplayName);
    Assert.Equal(ClientTypes.Public, descriptor.ClientType);

    // Verify Scopes/Permissions
    Assert.Contains(Permissions.Endpoints.Authorization, descriptor.Permissions);
    Assert.Contains(Permissions.Endpoints.Logout, descriptor.Permissions);
    Assert.Contains(Permissions.Endpoints.Token, descriptor.Permissions);
    Assert.Contains(Permissions.Endpoints.Introspection, descriptor.Permissions);
    Assert.Contains(Permissions.Prefixes.Endpoint + "userinfo", descriptor.Permissions);
    Assert.Contains(Permissions.GrantTypes.AuthorizationCode, descriptor.Permissions);
    Assert.Contains(Permissions.GrantTypes.RefreshToken, descriptor.Permissions);
    Assert.Contains(Permissions.ResponseTypes.Code, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Email, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Profile, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Roles, descriptor.Permissions);
    Assert.Contains($"{Permissions.Prefixes.Scope}{Scopes.OpenId}", descriptor.Permissions);

    // Verify Redirect URIs
    Assert.Contains(new Uri("http://localhost:4200"), descriptor.RedirectUris);
    Assert.Contains(new Uri("https://localhost:4200"), descriptor.RedirectUris);

    // Verify Post Logout Redirect URIs
    Assert.Contains(new Uri("http://localhost:4200"), descriptor.PostLogoutRedirectUris);
    Assert.Contains(new Uri("https://localhost:4200"), descriptor.PostLogoutRedirectUris);
  }

  [Fact]
  public async Task DocViewerClient_IsProperlyRegistered() {
    // Arrange
    using var scope = _factory.Services.CreateScope();
    var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

    // Act
    var client = await manager.FindByClientIdAsync("docviewer");

    // Assert
    Assert.NotNull(client);

    var descriptor = new OpenIddictApplicationDescriptor();
    await manager.PopulateAsync(descriptor, client);

    Assert.Equal("docviewer", descriptor.ClientId);
    Assert.Equal("DocViewer Application", descriptor.DisplayName);
    Assert.Equal(ClientTypes.Public, descriptor.ClientType);

    // Verify Scopes/Permissions
    Assert.Contains(Permissions.Endpoints.Authorization, descriptor.Permissions);
    Assert.Contains(Permissions.Endpoints.Logout, descriptor.Permissions);
    Assert.Contains(Permissions.Endpoints.Token, descriptor.Permissions);
    Assert.Contains(Permissions.GrantTypes.AuthorizationCode, descriptor.Permissions);
    Assert.Contains(Permissions.GrantTypes.RefreshToken, descriptor.Permissions);
    Assert.Contains(Permissions.ResponseTypes.Code, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Email, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Profile, descriptor.Permissions);
    Assert.Contains(Permissions.Scopes.Roles, descriptor.Permissions);

    // Verify Redirect URIs (for OIDC flow)
    Assert.Contains(new Uri("http://localhost:5173"), descriptor.RedirectUris);
    Assert.Contains(new Uri("http://localhost:5173/callback"), descriptor.RedirectUris);
    Assert.Contains(new Uri("http://localhost:5173/silent-renew"), descriptor.RedirectUris);

    // Verify Post Logout Redirect URIs
    Assert.Contains(new Uri("http://localhost:5173"), descriptor.PostLogoutRedirectUris);
  }
}
