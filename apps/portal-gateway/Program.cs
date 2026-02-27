using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Yarp.ReverseProxy.Transforms;

var builder = WebApplication.CreateBuilder(args);

// --- Rate Limiting Configuration ---
// Register the rate limiting services. This allows us to define and apply policies
// to protect our API from being overwhelmed by too many requests.
builder.Services.AddRateLimiter(options => {
  // Define a "token-bucket" policy. This is a common algorithm for rate limiting.
  // We are partitioning it by IP Address to ensure each client gets their own bucket.
  options.AddPolicy("token-bucket", httpContext =>
      RateLimitPartition.GetTokenBucketLimiter(
          // Use the client's IP address as the key for the rate limit partition.
          // This ensures each user has their own request limit.
          // If the IP is not available, we fall back to a generic key.
          partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
          factory: _ => new TokenBucketRateLimiterOptions {
            // Each IP address starts with 10 tokens.
            TokenLimit = 10,
            // The bucket is replenished every 1 minute.
            ReplenishmentPeriod = TimeSpan.FromMinutes(1),
            // 10 new tokens are added every replenishment period.
            TokensPerPeriod = 10,
            // Don't queue requests if the limit is hit; reject them immediately.
            QueueLimit = 0,
            AutoReplenishment = true
          }));

  // When a request is rejected, send a standard 429 "Too Many Requests" status code.
  options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// --- YARP Reverse Proxy Configuration ---
// Add the YARP (Yet Another Reverse Proxy) services and load its configuration
// from the "ReverseProxy" section of our appsettings.json file.
var gatewaySecret = builder.Configuration["GATEWAY_SECRET"] ??
                    builder.Configuration["Gateway:Secret"] ??
                    "portal-poc-secret-2026";

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(builderContext => {
      // JUNIOR RATIONALE: We dynamically inject the Gateway Secret into every 
      // request sent to the Backend API. This acts as our "Caller ID." 
      // By doing this in code, we can easily use environment variables.
      builderContext.AddRequestHeader("X-Gateway-Secret", gatewaySecret);
    });

// --- Forwarded Headers Configuration ---
// Configure how the app handles headers that are forwarded by proxies (like YARP itself
// or a load balancer). This is crucial for security and correct request processing.
builder.Services.Configure<ForwardedHeadersOptions>(options => {
  // Trust headers that specify the original client IP (X-Forwarded-For)
  // and the original protocol (X-Forwarded-Proto, e.g., 'https').
  options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

builder.Services.AddCors(options => {
  options.AddDefaultPolicy(policy => {
    policy.SetIsOriginAllowed(origin => {
      var host = new Uri(origin).Host;
      return host == "localhost" || host.EndsWith(".localhost");
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials();
  });
});

var app = builder.Build();

// --- Middleware Pipeline ---

// Enable the Forwarded Headers middleware. This must be placed early in the pipeline
// to ensure that downstream middleware sees the correct client IP and scheme.
app.UseForwardedHeaders();

app.UseCors();

// Enable the routing middleware, which is required for endpoint mapping.
app.UseRouting();

// Enable the rate limiting middleware. This will check incoming requests against
// the policies we defined and reject them if they exceed the limit.
app.UseRateLimiter();

// Map the YARP reverse proxy. This is where YARP takes over and forwards
// requests to the appropriate downstream service based on its configuration.
app.MapReverseProxy();

app.Run();

// This makes the auto-generated Program class public, which is a common practice
// required for our integration tests to be able to create a test host (WebApplicationFactory).
public partial class Program { }
