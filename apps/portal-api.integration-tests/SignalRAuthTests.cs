using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

/**
 * SignalRAuthTests validates our real-time security architecture.
 * 
 * JUNIOR RATIONALE: SignalR is tricky because it's not a standard REST call. 
 * We need to ensure that our Hub correctly recognizes both browser cookies (BFF) 
 * and API tokens (JWT), and is ready for the DPoP future.
 */
public class SignalRAuthTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private const string TestUserId = "signalr-test-user-001";

  public SignalRAuthTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  /**
   * Helper: Creates a factory with a mock authentication handler that 
   * can simulate either a cookie or a JWT.
   */
  private WebApplicationFactory<Program> CreateAuthenticatedFactory() {
    return _factory.WithWebHostBuilder(builder => {
      builder.ConfigureTestServices(services => {
        services.AddSingleton(new TestUserContext { UserId = TestUserId });
        services.AddAuthentication("TestAuth")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestAuth", null);

        // Ensure our Hub uses this test scheme.
        services.AddAuthorization(options => {
          options.DefaultPolicy = new AuthorizationPolicyBuilder("TestAuth")
              .RequireAuthenticatedUser()
              .Build();
        });
      });
    });
  }

  [Fact]
  public async Task ConnectToHub_ShouldSucceed_WithMockAuth() {
    // 1. Arrange
    var factory = CreateAuthenticatedFactory();
    var server = factory.Server;

    // We create a SignalR connection to our in-memory test server.
    var connection = new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/notifications", options => {
          options.HttpMessageHandlerFactory = _ => server.CreateHandler();
          // JUNIOR RATIONALE: We must provide the Gateway Secret for ALL calls 
          // to the backend, including the SignalR handshake.
          options.Headers.Add("X-Gateway-Secret", "portal-poc-secret-2026");
          // Simulate an auth header.
          options.Headers.Add("Authorization", "Bearer test-token");
          // JUNIOR RATIONALE: Even though SignalR browser clients can't easily 
          // add DPoP headers to WebSockets, the BFF Gateway CAN. We test that 
          // the Hub doesn't crash when it receives this modern security header.
          options.Headers.Add("DPoP", "mock-dpop-proof");
        })
        .Build();

    // 2. Act
    try {
      await connection.StartAsync();

      // 3. Assert
      Assert.Equal(HubConnectionState.Connected, connection.State);
    } finally {
      await connection.StopAsync();
    }
  }

  [Fact]
  public async Task ConnectToHub_ShouldSucceed_WithCookieAuth() {
    // 1. Arrange
    var factory = CreateAuthenticatedFactory();
    var server = factory.Server;

    var connection = new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/notifications", options => {
          options.HttpMessageHandlerFactory = _ => server.CreateHandler();
          options.Headers.Add("X-Gateway-Secret", "portal-poc-secret-2026");

          // JUNIOR RATIONALE: This is the true BFF pattern. The browser 
          // doesn't have a token; it has a cookie. We simulate the cookie 
          // being sent by the browser.
          options.Cookies.Add(new Cookie(".AspNetCore.Identity.Application", "mock-cookie-value", "/", "localhost"));
        })
        .Build();

    // 2. Act
    try {
      await connection.StartAsync();

      // 3. Assert
      Assert.Equal(HubConnectionState.Connected, connection.State);
    } finally {
      await connection.StopAsync();
    }
  }

  [Fact]
  public async Task ConnectToHub_ShouldFail_WhenUnauthenticated() {
    // 1. Arrange
    var server = _factory.Server;

    var connection = new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/notifications", options => {
          options.HttpMessageHandlerFactory = _ => server.CreateHandler();
          options.Headers.Add("X-Gateway-Secret", "portal-poc-secret-2026");
          // No auth headers here.
        })
        .Build();

    // 2. Act & Assert
    // SignalR usually throws a 401 (Unauthorized) during the 'Negotiate' phase.
    var exception = await Assert.ThrowsAsync<HttpRequestException>(async () => {
      await connection.StartAsync();
    });

    Assert.Equal(HttpStatusCode.Unauthorized, exception.StatusCode);
  }
}
