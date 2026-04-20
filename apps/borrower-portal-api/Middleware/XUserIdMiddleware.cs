using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Tai.BorrowerPortal.Api.Middleware;

/// <summary>
/// POC auth stub. Reads X-User-Id from request headers and sets HttpContext.User
/// with a NameIdentifier claim so ICurrentUserService.UserId works downstream.
/// Returns 401 if the header is missing.
///
/// To be replaced by OpenIddict bearer token validation when real auth lands.
/// </summary>
public class XUserIdMiddleware {
  public const string HeaderName = "X-User-Id";
  private readonly RequestDelegate _next;

  public XUserIdMiddleware(RequestDelegate next) {
    _next = next;
  }

  public async Task InvokeAsync(HttpContext context) {
    if (!context.Request.Headers.TryGetValue(HeaderName, out var userIdValues) || string.IsNullOrWhiteSpace(userIdValues)) {
      context.Response.StatusCode = StatusCodes.Status401Unauthorized;
      await context.Response.WriteAsync($"Missing {HeaderName} header.");
      return;
    }

    var identity = new ClaimsIdentity(authenticationType: "XUserIdStub");
    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdValues!));
    context.User = new ClaimsPrincipal(identity);

    await _next(context);
  }
}
