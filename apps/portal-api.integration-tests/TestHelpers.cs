using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Tai.Portal.Api.IntegrationTests;

public class TestUserContext {
  public string UserId { get; set; } = string.Empty;
}

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions> {
  private readonly TestUserContext _userContext;

  public TestAuthHandler(
      IOptionsMonitor<AuthenticationSchemeOptions> options,
      ILoggerFactory logger,
      UrlEncoder encoder,
      TestUserContext userContext)
      : base(options, logger, encoder) {
    _userContext = userContext;
  }

  protected override Task<AuthenticateResult> HandleAuthenticateAsync() {
    if (string.IsNullOrEmpty(_userContext.UserId)) {
      return Task.FromResult(AuthenticateResult.Fail("No user context provided."));
    }

    var claims = new[] {
        new Claim(ClaimTypes.NameIdentifier, _userContext.UserId),
        new Claim(ClaimTypes.Name, "Test User"),
        new Claim("sub", _userContext.UserId)
    };
    var identity = new ClaimsIdentity(claims, Scheme.Name);
    var principal = new ClaimsPrincipal(identity);
    var ticket = new AuthenticationTicket(principal, Scheme.Name);

    return Task.FromResult(AuthenticateResult.Success(ticket));
  }
}

public class AllowAnonymousAuthorizationHandler : IAuthorizationHandler {
  public Task HandleAsync(AuthorizationHandlerContext context) {
    var requirements = context.PendingRequirements.ToList();
    foreach (var requirement in requirements) {
      context.Succeed(requirement);
    }
    return Task.CompletedTask;
  }
}

public class BypassAuthorizationService : IAuthorizationService {
  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements)
      => Task.FromResult(AuthorizationResult.Success());

  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
      => Task.FromResult(AuthorizationResult.Success());
}
