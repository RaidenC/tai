using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Tai.Portal.Core.Infrastructure.Middleware;

/// <summary>
/// This Middleware is the "Caller ID" check.
/// 
/// JUNIOR RATIONALE: We only want our API to be accessible through the Gateway. 
/// If someone tries to call the API directly (bypassing the Gateway), they could 
/// fake their identity. This middleware checks for a "Secret Handshake" (a shared 
/// key) that only the Gateway knows. No key = No entry.
/// </summary>
public class GatewayTrustMiddleware {
  private readonly RequestDelegate _next;
  private readonly string _expectedSecret;

  public GatewayTrustMiddleware(RequestDelegate next, IConfiguration configuration) {
    _next = next;
    // JUNIOR RATIONALE: We store the secret in 'appsettings.json'. 
    // In production, this would be an Environment Variable or Key Vault secret.
    _expectedSecret = configuration["Gateway:Secret"] ?? string.Empty;
  }

  public async Task InvokeAsync(HttpContext context) {
    // 0. ALLOW OIDC Discovery to be public
    // JUNIOR RATIONALE: The browser needs to read the "Map" (Discovery Doc) 
    // and the "Public Keys" (JWKS) before it can start the login. 
    // We also allow the 'Account/Login' redirect to be public so the 
    // bridge to the Identity UI (4300) doesn't get blocked.
    if (context.Request.Path.Value?.Contains(".well-known/openid-configuration") == true ||
        context.Request.Path.Value?.Contains(".well-known/jwks") == true ||
        context.Request.Path.Value?.Contains("Account/Login") == true) {
      await _next(context);
      return;
    }

    // 1. Check if the "Secret Handshake" header is present
    if (!context.Request.Headers.TryGetValue("X-Gateway-Secret", out var receivedSecret) ||
        receivedSecret.ToString().Trim() != _expectedSecret.Trim()) {
      // 2. If the secret is missing or wrong, reject the request immediately.
      context.Response.StatusCode = StatusCodes.Status403Forbidden;
      await context.Response.WriteAsync("Untrusted request. Access must be via the Gateway.");
      return;
    }

    // 3. Secret matches! Continue to the rest of the app.
    await _next(context);
  }
}
