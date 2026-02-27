using System.Net;
using System.Threading.RateLimiting;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Yarp.ReverseProxy.Forwarder;

namespace Tai.Portal.Gateway.IntegrationTests;

// This test class follows the same xUnit and WebApplicationFactory setup as GatewayRoutingTests.
// It creates an in-memory instance of our Gateway application to test the rate limiting feature.
public class RateLimitingTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  private readonly TestMessageHandler _testHandler = new();

  public RateLimitingTests(WebApplicationFactory<Program> factory) {
    _factory = factory.WithWebHostBuilder(builder => {
      builder.ConfigureServices(services => {
        // As before, we replace the real HTTP forwarder with our test handler
        // to prevent real network calls and control the responses.
        services.AddSingleton<IForwarderHttpClientFactory>(new TestForwarderHttpClientFactory(_testHandler));

        // --- Override Rate Limiter Configuration for Testing ---
        // The main application in Program.cs already configures a rate limiter policy.
        // For our test, we want to define a *different*, much faster policy to avoid
        // having our tests wait for minutes.
        services.AddRateLimiter(options => {
          // We define a *new* policy specifically for this test.
          // NOTE: This will cause an error if the policy name already exists. In a real-world
          // scenario with many tests, you would clear existing policies or use unique names.
          // For this focused test, we are assuming a clean slate provided by WebApplicationFactory.
          options.AddPolicy("test-token-bucket", httpContext =>
              RateLimitPartition.GetTokenBucketLimiter(
                  // For simplicity and predictability in our test, we use a "fixed" partition key.
                  // This ensures all requests in this test fall into the same rate limit bucket.
                  partitionKey: "fixed",
                  factory: _ => new TokenBucketRateLimiterOptions {
                    TokenLimit = 1, // Allow only 1 request.
                    ReplenishmentPeriod = TimeSpan.FromSeconds(10), // Replenish the token every 10 seconds.
                    TokensPerPeriod = 1,
                    QueueLimit = 0, // Reject immediately if limit is exceeded.
                    AutoReplenishment = true
                  }));
          options.RejectionStatusCode = 429;
        });
      });

      // We provide in-memory configuration for YARP, just like in the routing test.
      builder.ConfigureAppConfiguration((context, config) => {
        config.AddInMemoryCollection(new Dictionary<string, string?> {
          ["ReverseProxy:Routes:TokenRoute:ClusterId"] = "IdentityCluster",
          // IMPORTANT: We tell YARP to apply our *test-specific* rate limiter policy to this route.
          ["ReverseProxy:Routes:TokenRoute:RateLimiterPolicy"] = "test-token-bucket",
          ["ReverseProxy:Routes:TokenRoute:Match:Path"] = "/connect/token",
          ["ReverseProxy:Clusters:IdentityCluster:Destinations:Destination1:Address"] = "http://backend-identity"
        });
      });
    });
  }

  // A test to verify that the rate limit is applied to the /connect/token endpoint.
  [Fact]
  public async Task RequestToTokenEndpoint_ShouldBeRateLimitedAfter1Request() {
    // ARRANGE: Get a client to our in-memory server.
    var client = _factory.CreateClient();

    // ACT & ASSERT (Part 1): Send the first request.
    // This request should be allowed because our test policy has a limit of 1.
    // It will be forwarded to our TestMessageHandler, which returns OK.
    var response = await client.PostAsync("/connect/token", null);
    response.StatusCode.Should().Be(HttpStatusCode.OK, "the first request should be allowed by the rate limiter");

    // ACT (Part 2): Send the second request immediately.
    // This request should be rejected by the rate limiting middleware before it ever gets to YARP.
    var limitedResponse = await client.PostAsync("/connect/token", null);

    // ASSERT (Part 2): Verify the rejection.
    // We expect the 'RejectionStatusCode' we configured: 429 Too Many Requests.
    limitedResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests, "the second request should be rate limited");
  }

  // A simple test double that always returns a 200 OK response.
  private class TestMessageHandler : HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) {
      return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
    }
  }

  // The factory that provides our test message handler to YARP.
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
