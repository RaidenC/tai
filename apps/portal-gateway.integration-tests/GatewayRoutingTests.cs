using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Yarp.ReverseProxy.Forwarder;

namespace Tai.Portal.Gateway.IntegrationTests;

// In xUnit, a test class acts as a container for related tests.
// The ': IClassFixture<WebApplicationFactory<Program>>' part is crucial for integration testing.
// - IClassFixture<T>: This tells xUnit to create a single instance of 'T' and share it among all tests in this class.
//   This is efficient because we don't want to restart our entire web application for every single test.
// - WebApplicationFactory<Program>: This is a special class from the 'Microsoft.AspNetCore.Mvc.Testing' library.
//   It bootstraps our web application (identified by its 'Program' class) in memory, allowing us to make
//   HTTP requests to it as if it were a real, running server.
public class GatewayRoutingTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly TestMessageHandler _testHandler = new();

  // The constructor of the test class receives the shared fixture instance that xUnit created.
  public GatewayRoutingTests(WebApplicationFactory<Program> factory) {
    // We customize the WebApplicationFactory for the tests in this specific class.
    _factory = factory.WithWebHostBuilder(builder => {
      // --- 1. Configure In-Memory Application Settings ---
      // Instead of relying on the real 'appsettings.json', we can provide specific configuration
      // for our tests. This makes tests isolated and predictable.
      builder.ConfigureAppConfiguration((context, config) => {
        config.AddInMemoryCollection(new Dictionary<string, string?> {
          // Define the YARP route and cluster configuration directly in memory for this test.
          ["ReverseProxy:Routes:IdentityRoute:ClusterId"] = "IdentityCluster",
          ["ReverseProxy:Routes:IdentityRoute:Match:Path"] = "/identity/{**catch-all}",
          // The destination address is a dummy URL. It won't actually be called because we are
          // intercepting the request in the next step.
          ["ReverseProxy:Clusters:IdentityCluster:Destinations:Destination1:Address"] = "http://backend-identity"
        });
      });

      // --- 2. Replace Real Services with Test Doubles (Mocks/Stubs) ---
      // 'ConfigureServices' lets us modify the application's dependency injection container.
      builder.ConfigureServices(services => {
        // Here, we replace the real 'IForwarderHttpClientFactory' (which creates the HTTP client YARP uses)
        // with our own 'TestForwarderHttpClientFactory'. This is a powerful technique called "Dependency Injection".
        // Our test factory will return an HTTP client that uses our 'TestMessageHandler', allowing us
        // to intercept the outgoing request from YARP instead of letting it make a real network call.
        services.AddSingleton<IForwarderHttpClientFactory>(new TestForwarderHttpClientFactory(_testHandler));
      });
    });
  }

  // The '[Fact]' attribute marks this method as a test that xUnit should discover and run.
  [Fact]
  public async Task RequestToIdentityPath_ShouldBeRoutedToIdentityService_WithCorrectHeaders() {
    // --- ARRANGE ---
    // The 'Arrange' step is where we set up the conditions for our test.
    // We get an HttpClient that is pre-configured to send requests to our in-memory test server.
    var client = _factory.CreateClient();
    var request = new HttpRequestMessage(HttpMethod.Get, "/identity/test");
    // We add these headers to the *incoming* request to simulate it coming from a trusted proxy.
    request.Headers.Add("X-Forwarded-For", "127.0.0.1");
    request.Headers.Add("X-Forwarded-Proto", "https");

    // --- ACT ---
    // The 'Act' step is where we execute the action we want to test.
    // We send the request to our in-memory Gateway application.
    var response = await client.SendAsync(request);

    // --- ASSERT ---
    // The 'Assert' step is where we verify the outcome.
    // We use the 'FluentAssertions' library here (e.g., 'Should().Be()') for more readable assertions.

    // Because our TestMessageHandler returns 'HttpStatusCode.OK', we expect the final response to be 200 OK.
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    // Now we check our 'TestMessageHandler' to see what request it received from YARP.
    _testHandler.LastRequest.Should().NotBeNull();
    _testHandler.LastRequest!.RequestUri!.ToString().Should().StartWith("http://backend-identity");
    _testHandler.LastRequest!.RequestUri!.ToString().Should().Contain("/identity/test");

    // Finally, we verify that YARP correctly appended the 'X-Forwarded-*' headers
    // before trying to send the request to the backend.
    _testHandler.LastRequest.Headers.Contains("X-Forwarded-For").Should().BeTrue();
    _testHandler.LastRequest.Headers.Contains("X-Forwarded-Proto").Should().BeTrue();
  }

  // This is a "Test Double" - a simple, fake version of HttpMessageHandler.
  // Its only job is to capture the last request it was asked to send and return a dummy 'OK' response.
  private class TestMessageHandler : HttpMessageHandler {
    public HttpRequestMessage? LastRequest { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) {
      LastRequest = request;
      return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
    }
  }

  // This is another "Test Double" that acts as a factory for our fake message handler.
  // We registered this in 'ConfigureServices' to ensure YARP uses our test handler.
  private class TestForwarderHttpClientFactory : IForwarderHttpClientFactory {
    private readonly HttpMessageHandler _handler;

    public TestForwarderHttpClientFactory(HttpMessageHandler handler) {
      _handler = handler;
    }

    public HttpMessageInvoker CreateClient(ForwarderHttpClientContext context) {
      return new HttpMessageInvoker(_handler);
    }
  }
}
